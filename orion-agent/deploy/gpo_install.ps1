# Orion Agent 2.0 — GPO Deployment Script
# -------------------------------------------------------------
# Instructions:
# 1. Place 'orion-agent.exe' and 'agent.yaml' in a network share (e.g. \\Server\Deploy\Orion)
# 2. Update the $SourcePath variable below.
# 3. Ao lado de cada arquivo publicado no share, publique também o hash SHA-256
#    correspondente em um arquivo de manifesto com o mesmo nome + ".sha256"
#    (ex.: orion-agent.exe.sha256 contendo só o hash em hex, uma linha).
#    Gere com: Get-FileHash orion-agent.exe -Algorithm SHA256 | Select-Object -ExpandProperty Hash
#    Isso é o que impede uma instalação a partir de um binário adulterado —
#    seja por um compartilhamento SMB comprometido, seja por corrupção de
#    transferência. Sem o manifesto, a instalação é abortada (falha segura).
# 4. Apply this script as a Computer Startup Script in GPO.

$InstallPath = "C:\Program Files\OrionAgent"
$SourcePath  = "\\SEU_SERVIDOR\caminho\do\agente" # <--- ALTERE AQUI PARA SEU SERVIDOR
$Executable  = "orion-agent.exe"
$Config      = "agent.yaml"

# Verifica a integridade de um arquivo já copiado contra o manifesto .sha256
# publicado ao lado do arquivo de origem no share. Retorna $true só se o
# manifesto existir E o hash bater — qualquer outro caso é tratado como falha,
# nunca como "ok por padrão".
function Test-ArquivoIntegro {
    param(
        [string]$CaminhoOrigem,
        [string]$CaminhoCopiado
    )

    $manifesto = "$CaminhoOrigem.sha256"
    if (!(Test-Path $manifesto)) {
        Write-Warning "Manifesto de hash ausente: $manifesto — instalação abortada por segurança."
        return $false
    }

    $esperado = (Get-Content $manifesto -Raw).Trim().ToUpperInvariant()
    $obtido   = (Get-FileHash -Path $CaminhoCopiado -Algorithm SHA256).Hash.ToUpperInvariant()

    if ($obtido -ne $esperado) {
        Write-Warning "Hash de $CaminhoCopiado não confere com $manifesto."
        Write-Warning "  esperado: $esperado"
        Write-Warning "  obtido:   $obtido"
        Write-Warning "Isso pode indicar um arquivo adulterado ou uma cópia corrompida — instalação abortada."
        return $false
    }

    return $true
}

# Create directory if it doesn't exist
if (!(Test-Path $InstallPath)) {
    New-Item -Path $InstallPath -ItemType Directory -Force
}

# Copy files from network share
$copiaOk = $true
try {
    Copy-Item -Path "$SourcePath\$Executable" -Destination "$InstallPath\$Executable" -Force -ErrorAction Stop
    Copy-Item -Path "$SourcePath\$Config" -Destination "$InstallPath\$Config" -Force -ErrorAction Stop
} catch {
    Write-Warning "Falha ao copiar arquivos do storage: $_"
    $copiaOk = $false
}

# Verificação de integridade — só prossegue para instalar/iniciar o serviço se
# AMBOS os arquivos copiados baterem com o hash publicado no share. Um binário
# ou config adulterados nunca chegam a rodar como serviço SYSTEM.
$integridadeOk = $false
if ($copiaOk) {
    $exeOk = Test-ArquivoIntegro -CaminhoOrigem "$SourcePath\$Executable" -CaminhoCopiado "$InstallPath\$Executable"
    $cfgOk = Test-ArquivoIntegro -CaminhoOrigem "$SourcePath\$Config" -CaminhoCopiado "$InstallPath\$Config"
    $integridadeOk = $exeOk -and $cfgOk
}

if (-not $integridadeOk) {
    Write-Warning "Verificação de integridade falhou — instalação/atualização do OrionAgent NÃO será realizada nesta execução."
    # Não remove os arquivos já copiados nem mexe no serviço existente (se houver):
    # preferimos deixar a versão anterior, íntegra, rodando a substituí-la por
    # algo não verificado.
    exit 1
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
