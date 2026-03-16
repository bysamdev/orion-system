# Orion Agent 2.0 — GPO Deployment Script
# -------------------------------------------------------------
# Instructions:
# 1. Place 'orion-agent.exe' and 'agent.yaml' in a network share (e.g. \\Server\Deploy\Orion)
# 2. Update the $SourcePath variable below.
# 3. Apply this script as a Computer Startup Script in GPO.

$InstallPath = "C:\Program Files\OrionAgent"
$SourcePath  = "\\SEU_SERVIDOR\caminho\do\agente" # <--- ALTERE AQUI PARA SEU SERVIDOR
$Executable  = "orion-agent.exe"
$Config      = "agent.yaml"

# Create directory if it doesn't exist
if (!(Test-Path $InstallPath)) {
    New-Item -Path $InstallPath -ItemType Directory -Force
}

# Copy files from network share
try {
    Copy-Item -Path "$SourcePath\$Executable" -Destination "$InstallPath\$Executable" -Force -ErrorAction Stop
    Copy-Item -Path "$SourcePath\$Config" -Destination "$InstallPath\$Config" -Force -ErrorAction Stop
} catch {
    Write-Warning "Falha ao copiar arquivos do storage: $_"
}

# Check if service is installed
$Service = Get-Service -Name "OrionAgent" -ErrorAction SilentlyContinue

if ($null -eq $Service) {
    Write-Host "Installing OrionAgent Service..."
    Start-Process -FilePath "$InstallPath\$Executable" -ArgumentList "install" -Wait -WindowStyle Hidden
}

# Ensure service is running
$Service = Get-Service -Name "OrionAgent" -ErrorAction SilentlyContinue
if ($Service.Status -ne 'Running') {
    Start-Service -Name "OrionAgent"
}
