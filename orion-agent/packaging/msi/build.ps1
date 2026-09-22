# WixBinDir: pasta com candle.exe/light.exe. Padrao e o WiX 3.14 instalado;
# tambem aceita a pasta extraida do zip portatil (wix314-binaries.zip), que
# nao precisa de instalacao nem de administrador.
param(
    [string]$WixBinDir = "C:\Program Files (x86)\WiX Toolset v3.14\bin"
)

$ErrorActionPreference = "Stop"

$candle = Join-Path $WixBinDir "candle.exe"
$light  = Join-Path $WixBinDir "light.exe"

if (-not (Test-Path $candle)) {
    throw "WiX v3.14 nao encontrado em $WixBinDir. Informe -WixBinDir."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$msiDir = $PSScriptRoot
$instaladorOrigem = Join-Path $repoRoot "lib\assets\installer\OrionInstaller.exe"
$instaladorLocal = Join-Path $msiDir "OrionInstaller.exe"

# Mesma versao que o agente reporta (orion-agent/version/version.go).
$versaoGo = Get-Content (Join-Path $repoRoot "orion-agent\version\version.go") -Raw
if ($versaoGo -notmatch 'var Version = "(\d+\.\d+\.\d+)"') { throw "versao nao encontrada em version.go" }
$versao = $Matches[1]
Write-Host "Versao do agente: $versao"

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
    New-Item -ItemType Directory -Force -Path dist | Out-Null
    go build -ldflags="-H=windowsgui -s -w" -o orion-agent.exe .
    # O instalador embute o agente em gzip (~40% do tamanho) e sai sem
    # tabela de símbolos (-s -w): de ~17 MB para ~9 MB por instalador gerado.
    go run ./cmd/compactar-agente orion-agent.exe cmd\installer\assets\orion-agent.exe.gz
    go build -trimpath -ldflags="-s -w" -o $instaladorOrigem ./cmd/installer
    go build -trimpath -ldflags="-s -w" -o dist\OrionAgentSetup.exe ./cmd/installer
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
    & $candle -nologo "-dVersao=$versao" OrionAgent.wxs -o OrionAgent.wixobj
    if ($LASTEXITCODE -ne 0) { throw "candle.exe falhou" }
    & $light -nologo OrionAgent.wixobj -o OrionAgent.msi
    if ($LASTEXITCODE -ne 0) { throw "light.exe falhou" }
} finally {
    Pop-Location
}

Write-Host "5/5 Publicando pro backend (lib/assets/installer/OrionAgent.msi)..."
Copy-Item (Join-Path $msiDir "OrionAgent.msi") (Join-Path $repoRoot "lib\assets\installer\OrionAgent.msi") -Force

Write-Host "Pronto. Rode 'go build ./...' na raiz do repo pra confirmar o embed."