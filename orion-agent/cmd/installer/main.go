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
	"time"

	"golang.org/x/sys/windows"

	"orion-agent/addremove"
	"orion-agent/shortcut"
	"orion-agent/startup"
	"orion-agent/version"
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

// modoSilencioso vem de -silent/--silent/"/silent" na linha de comando —
// pensado pra rodar via Script de Inicialização de GPO: nesse contexto o
// processo já roda como SYSTEM (sem prompt de UAC, sempre elevado) e sem
// ninguém pra apertar ENTER no final. pausarSeInterativo é o único lugar
// que consulta esta flag; o resto do fluxo (banner, passos) roda igual —
// só imprime em stdout, não bloqueia nada.
var modoSilencioso bool

// flagAgentKey/flagAPIURL/flagCompanyName vêm de -agent-key=/-api-url=/
// -company-name= na linha de comando — é como o .msi genérico (um único
// build, sem chave embutida) recebe a configuração da empresa: o
// CustomAction do MSI passa essas propriedades (AGENTKEY etc., preenchidas
// pelo administrador na hora do msiexec ou via transform de GPO) direto
// pro instalador. Quando -agent-key vem preenchida, tem prioridade sobre
// qualquer configuração anexada nos bytes do próprio .exe (ver
// selfconfig.go) — line de comando é sempre uma escolha explícita de quem
// está instalando.
var (
	flagAgentKey    string
	flagAPIURL      string
	flagCompanyName string
)

func main() {
	for _, arg := range os.Args[1:] {
		switch {
		case arg == "-silent" || arg == "--silent" || arg == "/silent":
			modoSilencioso = true
		case strings.HasPrefix(arg, "-agent-key="):
			flagAgentKey = strings.TrimPrefix(arg, "-agent-key=")
		case strings.HasPrefix(arg, "--agent-key="):
			flagAgentKey = strings.TrimPrefix(arg, "--agent-key=")
		case strings.HasPrefix(arg, "-api-url="):
			flagAPIURL = strings.TrimPrefix(arg, "-api-url=")
		case strings.HasPrefix(arg, "--api-url="):
			flagAPIURL = strings.TrimPrefix(arg, "--api-url=")
		case strings.HasPrefix(arg, "-company-name="):
			flagCompanyName = strings.TrimPrefix(arg, "-company-name=")
		case strings.HasPrefix(arg, "--company-name="):
			flagCompanyName = strings.TrimPrefix(arg, "--company-name=")
		}
	}

	imprimirBanner()

	imprimirPasso(1, totalPassos, "Verificando privilégios de administrador...")
	elevado, err := estaElevado()
	if err != nil {
		falharComPausa("Não foi possível verificar o nível de privilégio: %v", err)
	}

	if !elevado {
		if !modoSilencioso {
			imprimirAviso("Privilégio de administrador necessário para registrar o serviço Windows")
			fmt.Println("      Solicitando elevação (UAC)...")
			if err := relançarElevado(); err != nil {
				falharComPausa("Não foi possível solicitar elevação: %v\nExecute este instalador manualmente como Administrador.", err)
			}
			return
		}
	} else {
		imprimirOK("Privilégios de administrador confirmados")
	}

	if err := instalar(); err != nil {
		falharComPausa("Falha na instalação: %v", err)
	}

	pausarSeInterativo("Pressione ENTER para fechar...")
}

// totalPassos é fixo em 4 mesmo no caminho em que o serviço não é
// registrado (agent_key ainda no placeholder) — a etapa 4 nesse caso vira a
// caixa de pendência em vez de "serviço iniciado", mas a contagem
// [n/4] permanece estável do início ao fim de uma mesma execução.
const totalPassos = 4

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

// pararServicoSeRodando para o serviço OrionAgent se ele já existir e
// estiver em execução — precisa acontecer ANTES de sobrescrever
// orion-agent.exe: o Windows recusa gravar por cima do .exe de um processo
// em execução ("Access is denied"). Sem isso, uma atualização em cima de
// um agente já ativo (manual ou via auto-atualização remota — ver
// ComandoAutoUpdate no backend) falhava na escrita do arquivo, ou pior:
// dependendo de quando o SCM decidisse encerrar o processo, podia deixar
// o binário truncado no meio da gravação.
//
// Tolerante de propósito: serviço inexistente (primeira instalação) ou já
// parado não é erro — só avisa (não interrompe a instalação) se o "sc
// stop" falhar ou não confirmar a parada a tempo; o WriteFile seguinte vai
// falhar com um erro mais claro se o arquivo continuar travado.
func pararServicoSeRodando() {
	// Encerra qualquer instância de bandeja ou processo em execução
	_ = exec.Command("taskkill", "/F", "/IM", "orion-agent.exe").Run()

	out, err := exec.Command("sc", "query", "OrionAgent").CombinedOutput()
	if err == nil && strings.Contains(string(out), "RUNNING") {
		imprimirAviso("serviço OrionAgent em execução — parando para atualizar")
		_ = exec.Command("sc", "stop", "OrionAgent").Run()
		prazo := time.Now().Add(15 * time.Second)
		for time.Now().Before(prazo) {
			out, err := exec.Command("sc", "query", "OrionAgent").CombinedOutput()
			if err == nil && strings.Contains(string(out), "STOPPED") {
				imprimirOK("Serviço existente parado")
				break
			}
			time.Sleep(300 * time.Millisecond)
		}
	}

	// Aguarda o arquivo ser totalmente liberado pelo sistema
	destinoExe := filepath.Join(pastaDestino, "orion-agent.exe")
	prazo := time.Now().Add(5 * time.Second)
	for time.Now().Before(prazo) {
		if f, err := os.OpenFile(destinoExe, os.O_WRONLY, 0755); err == nil {
			f.Close()
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
}

// gravarExeMesmoEmUso escreve o binário do agente por cima do que já existe,
// mesmo quando um processo ainda o mantém aberto.
//
// O Windows recusa SOBRESCREVER o .exe de um processo vivo, mas permite
// RENOMEAR: o processo continua rodando a partir do arquivo renomeado e o
// nome original fica livre para o binário novo.
//
// Isso importa no caminho de auto-atualização, onde o instalador roda pelo
// serviço (sessão 0, conta NT SERVICE\OrionAgent). O taskkill de
// pararServicoSeRodando derruba o serviço, mas NÃO alcança a bandeja do
// usuário — está em outra sessão e sob outra conta, e a conta virtual do
// serviço não tem privilégio para encerrá-la. A bandeja seguia viva
// segurando C:\Orion\orion-agent.exe, o os.WriteFile falhava com "Access is
// denied", instalar() abortava antes de re-registrar o serviço e a máquina
// ficava com o agente PARADO — sem monitoramento e sem se recuperar sozinha.
//
// O arquivo antigo é removido na próxima instalação: enquanto a bandeja
// antiga estiver viva, ele continua travado.
func gravarExeMesmoEmUso(destino string, conteudo []byte) error {
	limparBinariosAntigos(filepath.Dir(destino))

	if err := os.WriteFile(destino, conteudo, 0755); err == nil {
		return nil
	}

	// Só chega aqui quando algum processo ainda segura o arquivo.
	antigo := fmt.Sprintf("%s.old-%d", destino, time.Now().UnixNano())
	if err := os.Rename(destino, antigo); err != nil {
		return fmt.Errorf("liberar o executável em uso (%s): %w", destino, err)
	}
	imprimirAviso("executável em uso por outro processo — substituído via renomeação")

	if err := os.WriteFile(destino, conteudo, 0755); err != nil {
		// Devolve o original ao lugar para não deixar a instalação sem binário.
		_ = os.Rename(antigo, destino)
		return err
	}
	return nil
}

// limparBinariosAntigos apaga os .old-* deixados por atualizações passadas.
// Best-effort: os que ainda estiverem em uso continuam travados e caem na
// próxima passagem.
func limparBinariosAntigos(pasta string) {
	entradas, err := os.ReadDir(pasta)
	if err != nil {
		return
	}
	for _, e := range entradas {
		if strings.Contains(e.Name(), "orion-agent.exe.old-") {
			_ = os.Remove(filepath.Join(pasta, e.Name()))
		}
	}
}

// instalar copia os arquivos embutidos para pastaDestino e, se já houver uma
// agent_key real configurada (não o placeholder do template), registra e
// inicia o serviço Windows. Sem uma chave real, orion-agent.exe se recusa a
// rodar (config.Load, por design — ver orion-agent/config/config.go), então
// tentar "install" nesse caso só produziria um erro confuso; preferimos
// deixar os arquivos prontos e orientar o técnico a completar a
// configuração.
func instalar() error {
	imprimirPasso(2, totalPassos, fmt.Sprintf("Copiando arquivos para %s...", pastaDestino))

	if err := os.MkdirAll(pastaDestino, 0755); err != nil {
		return fmt.Errorf("criar %s: %w", pastaDestino, err)
	}

	// Se já existe um serviço OrionAgent rodando (reinstalação/atualização
	// em cima de um agente ativo — inclusive via auto-atualização remota,
	// ver ComandoAutoUpdate no backend), o Windows recusa sobrescrever o
	// .exe do processo em execução. Precisa parar primeiro.
	pararServicoSeRodando()

	destinoExe := filepath.Join(pastaDestino, "orion-agent.exe")
	if err := gravarExeMesmoEmUso(destinoExe, agenteEmbutido); err != nil {
		return fmt.Errorf("gravar orion-agent.exe: %w", err)
	}
	imprimirOK(destinoExe)

	// Auto-início no login (HKCU\...\Run): é o que faz a bandeja aparecer
	// sozinha quando o usuário loga, sem precisar clicar no .exe. Falha
	// aqui não impede o resto da instalação — o serviço Windows continua
	// cobrindo a máquina de qualquer forma, só sem o ícone automático.
	if err := startup.Enable(destinoExe); err != nil {
		imprimirAviso(fmt.Sprintf("não foi possível configurar o início automático no login: %v", err))
	} else {
		imprimirOK("Início automático no login configurado")
	}

	// Registro em Configurações > Aplicativos Instalados — sem isso o
	// agente existe na máquina mas não aparece ali nem no Painel de
	// Controle, e desinstalar exigia saber de cor o comando
	// `orion-agent.exe uninstall`.
	if err := addremove.Registrar(destinoExe, version.Version); err != nil {
		imprimirAviso(fmt.Sprintf("não foi possível registrar em Aplicativos Instalados: %v", err))
	} else {
		imprimirOK("Registrado em Aplicativos Instalados (Configurações > Apps)")
	}

	// Criação do atalho na Área de Trabalho com o ícone do Orion
	if err := shortcut.CreatePortalShortcut(flagAPIURL, ""); err != nil {
		imprimirAviso(fmt.Sprintf("não foi possível criar o atalho na Área de Trabalho: %v", err))
	} else {
		imprimirOK("Atalho 'Abrir Chamado Orion' criado na Área de Trabalho")
	}

	// Instalador gerado pelo Orion System pra uma empresa específica traz a
	// chave já colada no próprio .exe (ver selfconfig.go) — nesse caso
	// gravamos agent.yaml com a chave pronta e SEMPRE sobrescrevemos: é
	// exatamente pra isso que um instalador personalizado foi gerado. Sem
	// config anexada, mantém o comportamento manual de sempre — só escreve
	// o template se agent.yaml ainda não existir, pra não perder uma chave
	// já configurada à mão numa reinstalação/atualização.
	cfgAnexada, errCfg := lerConfigAnexada()
	if errCfg != nil {
		imprimirAviso(fmt.Sprintf("configuração personalizada anexada inválida, seguindo com instalação manual: %v", errCfg))
		cfgAnexada = nil
	}
	if flagAgentKey != "" {
		cfgAnexada = &configAnexada{AgentKey: flagAgentKey, APIURL: flagAPIURL, CompanyName: flagCompanyName}
	}

	destinoConfig := filepath.Join(pastaDestino, "agent.yaml")
	if cfgAnexada != nil {
		if err := os.WriteFile(destinoConfig, gerarConfigComChave(cfgAnexada), 0644); err != nil {
			return fmt.Errorf("gravar agent.yaml: %w", err)
		}
		rotulo := destinoConfig + " (chave da empresa aplicada automaticamente)"
		if cfgAnexada.CompanyName != "" {
			rotulo = fmt.Sprintf("%s (chave de %s aplicada automaticamente)", destinoConfig, cfgAnexada.CompanyName)
		}
		imprimirOK(rotulo)
	} else {
		configJaExiste := false
		if _, err := os.Stat(destinoConfig); err == nil {
			configJaExiste = true
		}
		if !configJaExiste {
			if err := os.WriteFile(destinoConfig, configTemplate, 0644); err != nil {
				return fmt.Errorf("gravar agent.yaml: %w", err)
			}
			imprimirOK(destinoConfig + " (novo, com valores padrão)")
		} else {
			imprimirOK(destinoConfig + " (já existe — mantido sem alteração)")
		}
	}

	imprimirPasso(3, totalPassos, "Verificando configuração...")
	chaveConfigurada, err := agentKeyConfigurada(destinoConfig)
	if err != nil {
		return fmt.Errorf("ler agent_key de %s: %w", destinoConfig, err)
	}

	if !chaveConfigurada {
		imprimirAviso("agent_key ainda não foi configurada")
		imprimirCaixaFinal(corAmarela, "Instalação parcial — configure a agent_key")
		fmt.Printf("Edite %s e substitua 'agent_key' pela chave\nreal da empresa. Depois, rode manualmente (como Administrador):\n\n", destinoConfig)
		fmt.Printf("  %s install\n", destinoExe)
		fmt.Println(`  sc start OrionAgent`)
		fmt.Println()
		return nil
	}
	imprimirOK("agent_key configurada")

	if err := registrarEIniciarServico(destinoExe); err != nil {
		return err
	}

	// Inicia a bandeja interativa na barra de tarefas do usuário imediatamente
	iniciarBandejaUsuario(destinoExe)

	imprimirCaixaFinal(corVerde, "Instalação concluída com sucesso")
	return nil
}

// iniciarBandejaUsuario inicia a bandeja interativa na barra de tarefas do usuário
func iniciarBandejaUsuario(caminhoExe string) {
	// Dispara via explorer.exe para rebaixar os privilégios (drop privileges).
	// O instalador roda elevado (Admin), se iniciarmos o agente direto, o ícone
	// da bandeja não aparece no Explorer do usuário comum devido ao UIPI.
	cmd := exec.Command("explorer.exe", caminhoExe)
	if err := cmd.Start(); err != nil {
		imprimirAviso(fmt.Sprintf("não foi possível iniciar a bandeja interativa: %v", err))
	} else {
		imprimirOK("Bandeja do sistema iniciada na barra de tarefas")
	}
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

// servicoJaRegistrado checa se o serviço OrionAgent já existe na SCM via
// "sc query" — SERVICE_QUERY_STATUS é concedido por padrão a qualquer
// usuário autenticado, então esta checagem funciona mesmo sem privilégio
// nenhum (ao contrário de "install", ver comentário em
// registrarEIniciarServico).
func servicoJaRegistrado() bool {
	_, err := exec.Command("sc", "query", "OrionAgent").CombinedOutput()
	return err == nil
}

// registrarEIniciarServico roda "orion-agent.exe install" (só quando o
// serviço ainda não existe) e depois inicia o serviço.
//
// "install" (kardianos/service → CreateService) exige um privilégio de
// SC_MANAGER — do gerenciador de serviços inteiro, não do serviço em si —
// que só Administrador/SYSTEM têm; não dá pra conceder isso à conta virtual
// do serviço sem abrir a porta pra ela criar/alterar QUALQUER serviço da
// máquina. Por isso, em toda atualização automática (o instalador roda pelo
// próprio serviço, sob NT SERVICE\OrionAgent, sem elevação — ver
// modoSilencioso em main()), tentar reinstalar sempre falhava com
// "Access is denied", mesmo sendo desnecessário: o caminho do binário e a
// configuração do serviço não mudam numa atualização, só o conteúdo do
// .exe (já trocado por gravarExeMesmoEmUso). Pular "install" quando o
// serviço já existe evita essa tentativa fadada ao fracasso.
//
// "start" já funciona sem elevação: a instalação original concede
// SERVICE_START/SERVICE_STOP ao SID da própria conta virtual do serviço
// (ver concederAutoGerenciamento) — direito escopado a ESTE serviço
// específico, não ao gerenciador inteiro.
func registrarEIniciarServico(caminhoExe string) error {
	imprimirPasso(4, totalPassos, "Registrando e iniciando o serviço Windows...")

	if servicoJaRegistrado() {
		imprimirOK("Serviço OrionAgent já registrado")
	} else {
		instalarCmd := exec.Command(caminhoExe, "install")
		out, err := instalarCmd.CombinedOutput()
		if err != nil {
			imprimirAviso(fmt.Sprintf("install: %v — %s", err, strings.TrimSpace(string(out))))
		} else {
			imprimirOK("Serviço OrionAgent registrado")
			if err := concederAutoGerenciamento(); err != nil {
				imprimirAviso(fmt.Sprintf("não foi possível conceder auto-gerenciamento ao serviço: %v", err))
			}
		}
	}

	startCmd := exec.Command("sc", "start", "OrionAgent")
	out, err := startCmd.CombinedOutput()
	if err != nil {
		// "1056" = serviço já em execução — não é falha real.
		if strings.Contains(string(out), "1056") {
			imprimirOK("Serviço já estava em execução")
			return nil
		}
		imprimirErro(strings.TrimSpace(string(out)))
		return fmt.Errorf("iniciar serviço: %w", err)
	}
	imprimirOK("Serviço em execução")
	return nil
}

// concederAutoGerenciamento dá ao próprio serviço OrionAgent (à conta
// virtual NT SERVICE\OrionAgent que o executa, ver ServiceConfig em
// orion-agent/service/windows.go) o direito de SERVICE_START/SERVICE_STOP
// sobre si mesmo — sem isso, toda auto-atualização remota (o instalador
// baixado roda sob essa mesma conta, sem elevação — modoSilencioso em
// main()) conseguia trocar o binário mas nunca conseguia religar o
// serviço, deixando a máquina sem monitoramento até alguém religar na mão.
//
// Chamada só uma vez, logo após o "install" ORIGINAL suceder — que sempre
// roda elevado (via UAC, ver relançarElevado), o único momento em que a
// ACL da SCM pode ser alterada. A permissão fica gravada na SCM e
// atravessa reinícios e atualizações futuras.
//
// Escopada ao SID desta instância específica de serviço (obtido via
// "sc showsid", não hardcoded) — não ao gerenciador de serviços inteiro, e
// não a "Usuários Autenticados" em geral: a conta virtual continua sem
// poder tocar em nenhum OUTRO serviço da máquina.
// extrairSIDDeShowsid lê a saída de "sc showsid <serviço>" (em pt-BR:
// "NOME: ...\nSID DO SERVIÇO: S-1-5-80-...\nSTATUS: ...") e devolve só o
// SID. O prefixo "S-1-5-80" identifica um SID de conta de serviço virtual
// (NT SERVICE\*) — checagem extra pra não aceitar linha errada caso o
// formato da saída mude entre versões do Windows.
func extrairSIDDeShowsid(saida string) (string, error) {
	for _, linha := range strings.Split(saida, "\n") {
		if idx := strings.IndexByte(linha, ':'); idx != -1 && strings.Contains(linha, "S-1-5-80") {
			return strings.TrimSpace(linha[idx+1:]), nil
		}
	}
	return "", fmt.Errorf("SID do serviço não encontrado na saída de 'sc showsid': %s", strings.TrimSpace(saida))
}

func concederAutoGerenciamento() error {
	out, err := exec.Command("sc", "showsid", "OrionAgent").CombinedOutput()
	if err != nil {
		return fmt.Errorf("obter SID do serviço: %w — %s", err, strings.TrimSpace(string(out)))
	}
	sid, err := extrairSIDDeShowsid(string(out))
	if err != nil {
		return err
	}

	// Base = ACL padrão que o Windows já atribui a todo serviço novo
	// (SYSTEM e Administradores com controle total, Usuários Interativos e
	// de Serviço só com consulta) — só adiciona a permissão extra pro SID
	// desta instância, sem tocar no resto.
	sddl := "D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)" +
		"(A;;CCLCSWLOCRRC;;;IU)(A;;CCLCSWLOCRRC;;;SU)" +
		"(A;;CCLCSWRPWPLOCRRC;;;" + sid + ")"

	out, err = exec.Command("sc", "sdset", "OrionAgent", sddl).CombinedOutput()
	if err != nil {
		return fmt.Errorf("aplicar ACL: %w — %s", err, strings.TrimSpace(string(out)))
	}
	imprimirOK("Serviço configurado para se auto-gerenciar em atualizações futuras")
	return nil
}

func pausar(mensagem string) {
	fmt.Println(mensagem)
	fmt.Scanln()
}

// pausarSeInterativo pula a pausa em modo silencioso — esperar ENTER num
// Script de Inicialização de GPO (sem console interativo de verdade) só
// prenderia a instalação até estourar o timeout que o GPO impõe a scripts
// de início.
func pausarSeInterativo(mensagem string) {
	if modoSilencioso {
		return
	}
	pausar(mensagem)
}

func falharComPausa(formato string, args ...any) {
	imprimirCaixaFinal(corVermelha, "Falha na instalação")
	fmt.Fprintf(os.Stderr, colorir(corVermelha, formato)+"\n", args...)
	pausarSeInterativo("Pressione ENTER para fechar...")
	os.Exit(1)
}
