// Command installer é um instalador autônomo do Orion Agent: um único .exe
// que já carrega o binário do agente embutido (go:embed), pede elevação de
// Administrador via UAC quando necessário (registrar um serviço Windows
// exige isso — ver orion-agent/service/windows.go) e copia tudo para
// C:\Orion.
//
// Existe porque `orion-agent.exe install` sozinho falha com "Access is
// denied" quando rodado sem elevação (kardianos/service chama o Service
// Control Manager, que exige admin) — este instalador resolve isso
// solicitando elevação automaticamente, em vez de exigir que o técnico abra
// um prompt "Executar como Administrador" manualmente.
package main

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"golang.org/x/sys/windows"
)

//go:embed assets/orion-agent.exe
var agenteEmbutido []byte

//go:embed assets/agent.yaml
var configTemplate []byte

// pastaDestino é fixa em C:\Orion — pedido explícito de instalação na raiz
// do disco C:, para ficar num caminho curto e previsível em toda a frota
// (evita depender de %ProgramFiles% ou do diretório do usuário que
// disparou a instalação, já que o serviço roda sob NT SERVICE\OrionAgent).
const pastaDestino = `C:\Orion`

const placeholderAgentKey = "COLOQUE_SUA_CHAVE_AQUI"

func main() {
	fmt.Println("=== Instalador do Orion Agent ===")

	elevado, err := estaElevado()
	if err != nil {
		falharComPausa("Não foi possível verificar o nível de privilégio: %v", err)
	}

	if !elevado {
		fmt.Println("Este instalador precisa de privilégio de Administrador para registrar o serviço Windows.")
		fmt.Println("Solicitando elevação (UAC)...")
		if err := relançarElevado(); err != nil {
			falharComPausa("Não foi possível solicitar elevação: %v\nExecute este instalador manualmente como Administrador.", err)
		}
		return
	}

	if err := instalar(); err != nil {
		falharComPausa("Falha na instalação: %v", err)
	}

	pausar("Instalação concluída. Pressione ENTER para fechar...")
}

// estaElevado verifica se o processo atual já roda com token elevado —
// mesmo critério que o Windows usa para decidir se uma ação exige um novo
// prompt UAC.
func estaElevado() (bool, error) {
	var token windows.Token
	proc, err := windows.GetCurrentProcess()
	if err != nil {
		return false, err
	}
	if err := windows.OpenProcessToken(proc, windows.TOKEN_QUERY, &token); err != nil {
		return false, err
	}
	defer token.Close()
	return token.IsElevated(), nil
}

// relançarElevado reabre este mesmo executável via ShellExecute com o verbo
// "runas", que é o gatilho padrão do Windows para o prompt de UAC — a
// mesma coisa que clicar em "Executar como administrador" no Explorer.
// O processo atual (não-elevado) termina logo em seguida; quem continua a
// instalação é a nova instância, já elevada.
func relançarElevado() error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("localizar o próprio executável: %w", err)
	}

	verb, _ := syscall.UTF16PtrFromString("runas")
	caminho, _ := syscall.UTF16PtrFromString(exe)
	diretorio, _ := syscall.UTF16PtrFromString(filepath.Dir(exe))

	return windows.ShellExecute(0, verb, caminho, nil, diretorio, windows.SW_NORMAL)
}

// instalar copia os arquivos embutidos para pastaDestino e, se já houver uma
// agent_key real configurada (não o placeholder do template), registra e
// inicia o serviço Windows. Sem uma chave real, orion-agent.exe se recusa a
// rodar (config.Load, por design — ver orion-agent/config/config.go), então
// tentar "install" nesse caso só produziria um erro confuso; preferimos
// deixar os arquivos prontos e orientar o técnico a completar a
// configuração.
func instalar() error {
	if err := os.MkdirAll(pastaDestino, 0755); err != nil {
		return fmt.Errorf("criar %s: %w", pastaDestino, err)
	}

	destinoExe := filepath.Join(pastaDestino, "orion-agent.exe")
	if err := os.WriteFile(destinoExe, agenteEmbutido, 0755); err != nil {
		return fmt.Errorf("gravar orion-agent.exe: %w", err)
	}
	fmt.Printf("✓ %s\n", destinoExe)

	// agent.yaml só é escrito se ainda não existir — uma reinstalação/
	// atualização não deve sobrescrever uma configuração já preenchida com
	// a agent_key real da empresa (mesma lógica de config.Load() ao criar
	// o arquivo padrão na primeira execução).
	destinoConfig := filepath.Join(pastaDestino, "agent.yaml")
	configJaExiste := false
	if _, err := os.Stat(destinoConfig); err == nil {
		configJaExiste = true
	}
	if !configJaExiste {
		if err := os.WriteFile(destinoConfig, configTemplate, 0644); err != nil {
			return fmt.Errorf("gravar agent.yaml: %w", err)
		}
		fmt.Printf("✓ %s (novo, com valores padrão)\n", destinoConfig)
	} else {
		fmt.Printf("• %s já existe — mantido sem alteração\n", destinoConfig)
	}

	chaveConfigurada, err := agentKeyConfigurada(destinoConfig)
	if err != nil {
		return fmt.Errorf("ler agent_key de %s: %w", destinoConfig, err)
	}

	if !chaveConfigurada {
		fmt.Println()
		fmt.Printf("Arquivos copiados, mas o serviço NÃO foi registrado: edite\n%s\ne substitua 'agent_key' pela chave real da empresa antes de instalar o serviço.\n", destinoConfig)
		fmt.Println()
		fmt.Println("Depois de editar, rode manualmente (como Administrador):")
		fmt.Printf("  %s install\n", destinoExe)
		fmt.Println(`  sc start OrionAgent`)
		return nil
	}

	return registrarEIniciarServico(destinoExe)
}

// agentKeyConfigurada faz uma checagem simples de texto — evitar importar o
// parser YAML completo aqui só para essa verificação. Suficiente porque o
// único valor que importa distinguir é a presença (ou não) do placeholder
// literal do template.
func agentKeyConfigurada(caminhoConfig string) (bool, error) {
	data, err := os.ReadFile(caminhoConfig)
	if err != nil {
		return false, err
	}
	conteudo := string(data)
	for _, linha := range strings.Split(conteudo, "\n") {
		linha = strings.TrimSpace(linha)
		if !strings.HasPrefix(linha, "agent_key:") {
			continue
		}
		valor := strings.TrimSpace(strings.TrimPrefix(linha, "agent_key:"))
		valor = strings.Trim(valor, `"'`)
		return valor != "" && valor != placeholderAgentKey, nil
	}
	return false, nil
}

// registrarEIniciarServico roda "orion-agent.exe install" e depois inicia o
// serviço. Se o serviço já existir (reinstalação), o erro de "install" é
// tolerado — seguimos direto para o start, que é o que de fato importa
// numa atualização.
func registrarEIniciarServico(caminhoExe string) error {
	fmt.Println("Registrando o serviço OrionAgent...")
	instalarCmd := exec.Command(caminhoExe, "install")
	if out, err := instalarCmd.CombinedOutput(); err != nil {
		fmt.Printf("(install: %v — %s; seguindo para iniciar, pode já estar registrado)\n", err, strings.TrimSpace(string(out)))
	} else {
		fmt.Print(string(out))
	}

	fmt.Println("Iniciando o serviço OrionAgent...")
	startCmd := exec.Command("sc", "start", "OrionAgent")
	out, err := startCmd.CombinedOutput()
	fmt.Print(string(out))
	if err != nil {
		// "1056" = serviço já em execução — não é falha real.
		if strings.Contains(string(out), "1056") {
			fmt.Println("(serviço já estava em execução)")
			return nil
		}
		return fmt.Errorf("iniciar serviço: %w", err)
	}
	return nil
}

func pausar(mensagem string) {
	fmt.Println(mensagem)
	fmt.Scanln()
}

func falharComPausa(formato string, args ...any) {
	fmt.Fprintf(os.Stderr, formato+"\n", args...)
	pausar("Pressione ENTER para fechar...")
	os.Exit(1)
}
