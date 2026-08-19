# build.ps1 — recompila o OrionAgent.msi a partir de OrionAgent.wxs.
#
# Pré-requisito: WiX Toolset v3.14 (candle.exe/light.exe) — não a v4/v7, que
# passou a exigir aceitar o "Open Source Maintenance Fee" da FireGiant.
# Instala via: winget install --id WiXToolset.WiXToolset
# (precisa do recurso do Windows NetFx3 habilitado — winget cuida disso, mas
# a ativação em si exige uma sessão elevada/administrador).
#
# Rodar sempre que orion-agent/cmd/installer for reconstruído (mesma
# situação em que lib/assets/installer/OrionInstaller.exe também precisa
# ser atualizado no backend — os dois embutem o mesmo binário).
#
# Uso (a partir desta pasta):
#   ./build.ps1
#
# Copia o resultado direto pra lib/assets/installer/OrionAgent.msi, de onde
# o backend embute via go:embed (ver lib/installer.go).

$ErrorActionPreference = "Stop"

$wixBin = "C:\Program Files (x86)\WiX Toolset v3.14\bin"
$candle = Join-Path $wixBin "candle.exe"
$light  = Join-Path $wixBin "light.exe"

if (-not (Test-Path $candle)) {
    throw "WiX v3.14 não encontrado em $wixBin — instale com: winget install --id WiXToolset.WiXToolset"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$msiDir = $PSScriptRoot
$instaladorOrigem = Join-Path $repoRoot "lib\assets\installer\OrionInstaller.exe"
$instaladorLocal = Join-Path $msiDir "OrionInstaller.exe"

Write-Host "1/4 Rebuild do OrionInstaller.exe (orion-agent/cmd/installer, GOOS=windows)..."
Push-Location (Join-Path $repoRoot "orion-agent")
try {
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    go build -o $instaladorOrigem ./cmd/installer
} finally {
    Remove-Item Env:\GOOS -ErrorAction SilentlyContinue
    Remove-Item Env:\GOARCH -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "2/4 Copiando OrionInstaller.exe pra dentro do pacote MSI..."
Copy-Item $instaladorOrigem $instaladorLocal -Force

Write-Host "3/4 Compilando (candle + light)..."
Push-Location $msiDir
try {
    & $candle OrionAgent.wxs -o OrionAgent.wixobj
    if ($LASTEXITCODE -ne 0) { throw "candle.exe falhou" }
    & $light OrionAgent.wixobj -o OrionAgent.msi
    if ($LASTEXITCODE -ne 0) { throw "light.exe falhou" }
} finally {
    Pop-Location
}

Write-Host "4/4 Publicando pro backend (lib/assets/installer/OrionAgent.msi)..."
Copy-Item (Join-Path $msiDir "OrionAgent.msi") (Join-Path $repoRoot "lib\assets\installer\OrionAgent.msi") -Force

Write-Host "Pronto. Rode 'go build ./...' na raiz do repo pra confirmar o embed."
