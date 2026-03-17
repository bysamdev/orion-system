# Guia de Instalação e Uso: Orion Agent 🤖

O **Orion Agent** é um binário leve desenvolvido em Go, projetado para rodar como um serviço nativo no Windows. Ele é responsável por coletar inventário de hardware, métricas de performance e permitir a execução de comandos remotos pelo portal administrativo.

## 📋 Pré-requisitos
- Sistema Operacional: Windows 10/11 ou Windows Server 2016+
- Privilégios: Administrador (para instalação do serviço)
- Acesso à Internet: HTTPS (Porta 443) para o domínio da API.

## ⚙️ Instalação Passo a Passo

### 1. Compilação (Se você tem o código-fonte)
Se desejar gerar o binário manualmente:
```bash
cd orion-agent
# Compila o binário ocultando a janela do console (-H windowsgui)
go build -ldflags "-H windowsgui" -o orion-agent.exe main.go
```

### 2. Registro como Serviço Windows
O agente deve ser instalado como um serviço para garantir que rode silenciosamente em segundo plano desde o boot.
Abra o **PowerShell como Administrador** e execute:
```powershell
.\orion-agent.exe install
.\orion-agent.exe start
```

### 3. Configuração do Tenant (Token)
Ao rodar pela primeira vez ou via GPO, o agente precisa saber a qual empresa ele pertence.
- O token pode ser configurado via arquivo `.env` na mesma pasta do executável ou via variáveis de ambiente.
- **Dica**: No painel administrativo do Orion, você pode gerar o comando de instalação já com o token embutido.

## 🚀 Funcionalidades Chave

### 🏠 Atalho de Acesso Direto (Portal de Chamados)
Uma das grandes vantagens do Orion Agent é a criação de um ícone na área de trabalho do usuário: **"Abrir Suporte Orion"**.
- Ao clicar, o portal abre automaticamente logado no hostname da máquina.
- **Sem senha**: O acesso é validado pelo token seguro da máquina, eliminando a necessidade de login manual para o usuário final.

### 💻 Terminal Remoto (Comandos)
O agente monitora constantemente por "comandos pendentes". 
- Técnicos podem enviar comandos via portal (ex: `ipconfig`, `systeminfo`, `restart service`).
- O agente executa o comando e devolve a saída para o portal em tempo real.

### 📊 Coleta de Inventário
A cada ciclo de *heartbeat*, o agente envia informações atualizadas de:
- Consumo de CPU %
- Uso de Memória RAM (Total vs Utilizada)
- Espaço em Disco (Todos os volumes montados)
- Tempo de Atividade (Uptime)

## 🛠️ Solução de Problemas (Troubleshooting)

- **Serviço não inicia**: Verifique se há outro processo `orion-agent` travado no Gerenciador de Tarefas.
- **Máquina não aparece no Dashboard**: Certifique-se de que a `AGENT_KEY` e o `VITE_API_URL` estão corretos no ambiente do sistema ou no arquivo de configuração do agente.
- **Logs**: O agente gera logs básicos no Event Viewer do Windows em caso de falha crítica na inicialização do serviço.

---
*Orion Agent - Monitoramento invisível, suporte invencível.*
