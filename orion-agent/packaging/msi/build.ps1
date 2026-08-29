$ErrorActionPreference = "Stop"

$wixBin = "C:\Program Files (x86)\WiX Toolset v3.14\bin"
$candle = Join-Path $wixBin "candle.exe"
$light  = Join-Path $wixBin "light.exe"

if (-not (Test-Path $candle)) {
    throw "WiX v3.14 nao encontrado em $wixBin"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$msiDir = $PSScriptRoot
$instaladorOrigem = Join-Path $repoRoot "lib\assets\installer\OrionInstaller.exe"
$instaladorLocal = Join-Path $msiDir "OrionInstaller.exe"

Write-Host "1/5 Gerando recursos de icone (resource.syso)..."
Push-Location (Join-Path $repoRoot "orion-agent")
try {
    # orion.ico e um arquivo estatico gerado a partir de tray.DataIcon (o
    # mesmo icone multi-resolucao que a bandeja usa em runtime) — precisa
    # existir em disco ANTES da compilacao pro goversioninfo embutir como
    # recurso PE. Regerado toda build pra nunca ficar dessincronizado dos
    # PNGs fonte em tray/assets/.
    go run ./cmd/gen-icon assets\orion.ico
    go run github.com/josephspurrier/goversioninfo/cmd/goversioninfo@v1.7.0 -platform-specific=false -o resource.syso versioninfo.json
    Push-Location cmd\installer
    try {
        # IconPath em versioninfo.json (../../assets/orion.ico) e relativo
        # ao diretorio de trabalho do goversioninfo, nao ao proprio JSON —
        # precisa rodar de dentro de cmd\installer pro caminho relativo bater.
        go run github.com/josephspurrier/goversioninfo/cmd/goversioninfo@v1.7.0 -platform-specific=false -o resource.syso versioninfo.json
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

Write-Host "2/5 Rebuild do orion-agent.exe e OrionInstaller.exe..."
Push-Location (Join-Path $repoRoot "orion-agent")
try {
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    go build -ldflags="-H=windowsgui -s -w" -o orion-agent.exe .
    Copy-Item -Force orion-agent.exe cmd\installer\assets\orion-agent.exe
    go build -o $instaladorOrigem ./cmd/installer
    go build -o dist\OrionAgentSetup.exe ./cmd/installer
} finally {
    Remove-Item Env:\GOOS -ErrorAction SilentlyContinue
    Remove-Item Env:\GOARCH -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "3/5 Copiando OrionInstaller.exe pra dentro do pacote MSI..."
Copy-Item $instaladorOrigem $instaladorLocal -Force

Write-Host "4/5 Compilando (candle + light)..."
Push-Location $msiDir
try {
    & $candle OrionAgent.wxs -o OrionAgent.wixobj
    if ($LASTEXITCODE -ne 0) { throw "candle.exe falhou" }
    & $light OrionAgent.wixobj -o OrionAgent.msi
    if ($LASTEXITCODE -ne 0) { throw "light.exe falhou" }
} finally {
    Pop-Location
}

Write-Host "5/5 Publicando pro backend (lib/assets/installer/OrionAgent.msi)..."
Copy-Item (Join-Path $msiDir "OrionAgent.msi") (Join-Path $repoRoot "lib\assets\installer\OrionAgent.msi") -Force

Write-Host "Pronto. Rode 'go build ./...' na raiz do repo pra confirmar o embed."