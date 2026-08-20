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

Write-Host "1/4 Rebuild do orion-agent.exe e OrionInstaller.exe..."
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