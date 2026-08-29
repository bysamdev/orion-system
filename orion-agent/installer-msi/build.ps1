# Compila installer-msi/Product.wxs em dist/OrionAgent.msi usando WiX
# Toolset v3 (candle.exe + light.exe).
#
# Requer orion-agent.exe e agent.yaml ja presentes na pasta orion-agent/
# (Product.wxs referencia ..\orion-agent.exe e ..\agent.yaml a partir desta
# pasta) - rode "go build -o orion-agent.exe ." antes, se precisar de um
# binario atualizado. Para que o agente reporte a versao real do release
# (em vez do fallback "1.0.0" de version.Version), injete no build:
#   go build -ldflags "-X orion-agent/version.Version=1.2.3" -o orion-agent.exe .
#
# WixBinDir precisa apontar para a pasta com candle.exe/light.exe extraida
# do zip portatil do WiX Toolset v3 (wixtoolset/wix3, wix314-binaries.zip) -
# nao ha instalacao, e so apontar para onde o zip foi extraido.
param(
    [Parameter(Mandatory = $true)]
    [string]$WixBinDir,
    [string]$OutDir = "$PSScriptRoot\..\dist"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "$WixBinDir\candle.exe")) {
    throw "candle.exe nao encontrado em $WixBinDir. Informe -WixBinDir apontando para os binarios do WiX Toolset v3."
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "Compilando Product.wxs..."
& "$WixBinDir\candle.exe" -nologo -out "$OutDir\Product.wixobj" "$PSScriptRoot\Product.wxs"
if ($LASTEXITCODE -ne 0) { throw "candle.exe falhou (exit $LASTEXITCODE)" }

Write-Host "Linkando MSI..."
& "$WixBinDir\light.exe" -nologo -ext WixUtilExtension -out "$OutDir\OrionAgent.msi" "$OutDir\Product.wixobj"
if ($LASTEXITCODE -ne 0) { throw "light.exe falhou (exit $LASTEXITCODE)" }

Write-Host "OK: $OutDir\OrionAgent.msi"
