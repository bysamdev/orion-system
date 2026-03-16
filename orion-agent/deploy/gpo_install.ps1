# Orion Agent 2.0 — GPO Deployment Script
# This script installs the Orion Agent as a Windows Service silently.

$InstallPath = "C:\Program Files\OrionAgent"
$SourcePath = "\\YOUR_DOMAIN_CONTROLLER\DeploymentShare\OrionAgent" # Update this
$Executable = "orion-agent.exe"
$Config = "agent.yaml"

# 1. Create directory
if (!(Test-Path $InstallPath)) {
    New-Item -Path $InstallPath -ItemType Directory -Force
}

# 2. Copy files if they are newer or don't exist
Copy-Item -Path "$SourcePath\$Executable" -Destination "$InstallPath\$Executable" -Force
Copy-Item -Path "$SourcePath\$Config" -Destination "$InstallPath\$Config" -Force

# 3. Check if service exists
$Service = Get-Service -Name "OrionAgent" -ErrorAction SilentlyContinue

if ($Service -eq $null) {
    # Install service
    Write-Host "Installing OrionAgent Service..."
    Start-Process -FilePath "$InstallPath\$Executable" -ArgumentList "install" -Wait -WindowStyle Hidden
}

# 4. Ensure service is running
$Service = Get-Service -Name "OrionAgent" -ErrorAction SilentlyContinue
if ($Service.Status -ne 'Running') {
    Write-Host "Starting OrionAgent Service..."
    Start-Service -Name "OrionAgent"
}

Write-Host "Orion Agent installed and running successfully."
