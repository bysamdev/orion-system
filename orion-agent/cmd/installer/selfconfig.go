package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
)

// marcadorConfig precisa ser byte-a-byte idêntico ao usado pelo backend ao
// gerar um instalador personalizado por empresa (ver
// handler/installer_handlers.go no repositório principal — não este
// módulo). O backend pega este mesmo instalador genérico já compilado e
// cola [marcadorConfig][tamanho em 4 bytes big-endian][JSON] depois do fim
// do .exe — Windows ignora dados extras depois do fim de um PE válido, e
// gerar o instalador personalizado vira colar bytes, sem recompilar nada.
// Mudar o formato aqui sem mudar lá quebra a leitura de instaladores já
// gerados (mas não os já baixados por clientes — cada .exe carrega o
// formato de quando foi gerado).
var marcadorConfig = []byte("ORIONINSTALLERCFGv1\x00")

// configAnexada é o que o backend embute: hoje só o que NÃO é segredo.
//
// AgentKey continua no struct por compatibilidade de leitura — instaladores
// gerados antes de 2026-09-17 ainda trazem a chave colada — mas o instalador
// DELIBERADAMENTE não a usa mais (ver resolverChaveDaEmpresa em main.go).
// Foi essa chave embutida que vazou: o .exe de uma empresa foi enviado ao
// VirusTotal, os sandboxes o executaram, e cada execução registrou uma
// máquina nova usando a credencial que viajava dentro do binário. Segredo
// dentro de arquivo distribuído é segredo publicado.
type configAnexada struct {
	AgentKey    string `json:"agent_key"`
	APIURL      string `json:"api_url,omitempty"`
	CompanyName string `json:"company_name,omitempty"`
}

// lerConfigAnexada procura marcadorConfig no próprio executável. Devolve
// (nil, nil) quando não há nada anexado — não é erro, é o instalador
// genérico de sempre (baixado do repositório, precisa editar agent.yaml à
// mão). Só devolve erro quando ACHA o marcador mas os dados depois dele
// estão corrompidos/truncados — sinal de um instalador personalizado
// gerado errado, vale avisar em vez de silenciosamente cair pro caminho
// manual.
func lerConfigAnexada() (*configAnexada, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("localizar o próprio executável: %w", err)
	}
	dados, err := os.ReadFile(exe)
	if err != nil {
		return nil, fmt.Errorf("ler o próprio executável: %w", err)
	}
	return decodificarConfigAnexada(dados)
}

// decodificarConfigAnexada faz o trabalho real sobre bytes já em memória —
// separada de lerConfigAnexada só pra ser testável sem precisar trocar
// os.Executable() (que não dá pra injetar).
func decodificarConfigAnexada(dados []byte) (*configAnexada, error) {
	idx := bytes.LastIndex(dados, marcadorConfig)
	if idx == -1 {
		return nil, nil
	}

	inicioTamanho := idx + len(marcadorConfig)
	if inicioTamanho+4 > len(dados) {
		return nil, fmt.Errorf("configuração anexada truncada (faltando o campo de tamanho)")
	}
	tamanho := binary.BigEndian.Uint32(dados[inicioTamanho : inicioTamanho+4])

	inicioJSON := inicioTamanho + 4
	fimJSON := inicioJSON + int(tamanho)
	if fimJSON > len(dados) || fimJSON < inicioJSON {
		return nil, fmt.Errorf("configuração anexada truncada (JSON incompleto)")
	}

	var cfg configAnexada
	if err := json.Unmarshal(dados[inicioJSON:fimJSON], &cfg); err != nil {
		return nil, fmt.Errorf("decodificar configuração anexada: %w", err)
	}
	// Bloco sem agent_key deixou de ser erro: desde 2026-09-17 o backend
	// embute só api_url/company_name, e a chave é digitada na instalação.
	return &cfg, nil
}

// resolverChaveDaEmpresa decide qual token da empresa será gravado no
// agent.yaml, nesta ordem:
//
//  1. -agent-key= na linha de comando — é como GPO, MSI e qualquer instalação
//     silenciosa passam o token, sem ninguém para digitar;
//  2. prompt interativo, quando a flag não veio e há console;
//  3. erro, em modo silencioso sem a flag — seguir sem token só produziria uma
//     instalação que nunca faz check-in, e o motivo apareceria muito depois.
//
// O que NÃO entra mais nessa ordem é a chave embutida no .exe. Ela existia
// para a instalação de um clique e foi exatamente o vetor do incidente do
// VirusTotal: o binário de uma empresa foi analisado por sandboxes e cada
// execução registrou uma máquina com a credencial que vinha dentro dele.
func resolverChaveDaEmpresa(cfg *configAnexada) (string, error) {
	return resolverChaveDaEmpresaDe(os.Stdin, flagAgentKey, modoSilencioso, cfg)
}

// devePedirTokenDaEmpresa decide se esta execução do instalador precisa de um
// token — e é a função que mantém a auto-atualização viva.
//
// A atualização remota roda este instalador com "-silent" e sem -agent-key=
// (lib.ComandoAutoUpdate). Nessa execução já existe agent.yaml com chave
// válida, e pedir token seria erro fatal em modo silencioso: a frota inteira
// pararia de se atualizar. Por isso "já configurada e sem flag" = não pede.
//
// A flag, quando vem, sempre reaplica: é uma escolha explícita de quem está
// instalando (inclusive para trocar a chave de uma máquina cuja empresa
// rotacionou o token).
func devePedirTokenDaEmpresa(chaveDaFlag string, chaveJaConfigurada bool) bool {
	if strings.TrimSpace(chaveDaFlag) != "" {
		return true
	}
	return !chaveJaConfigurada
}

// resolverChaveDaEmpresaDe é a decisão de verdade, com a entrada e as flags
// injetadas — separada só para ser testável sem mexer em os.Stdin nem em
// variável global, mesmo molde de garantirAtalhoUnico no pacote shortcut.
func resolverChaveDaEmpresaDe(entrada io.Reader, chaveDaFlag string, silencioso bool, cfg *configAnexada) (string, error) {
	if chave := strings.TrimSpace(chaveDaFlag); chave != "" {
		return chave, nil
	}

	if silencioso {
		return "", fmt.Errorf("instalação silenciosa exige -agent-key=<token da empresa> (a chave não vem mais embutida no instalador)")
	}

	empresa := ""
	if cfg != nil && cfg.CompanyName != "" {
		empresa = " de " + cfg.CompanyName
	}

	fmt.Println()
	fmt.Printf("      Informe o token da empresa%s (copie em Monitoramento > Onboarding no Orion):\n", empresa)
	fmt.Print("      Token: ")

	leitor := bufio.NewReader(entrada)
	digitado, err := leitor.ReadString('\n')
	if err != nil && strings.TrimSpace(digitado) == "" {
		return "", fmt.Errorf("não foi possível ler o token da empresa: %w", err)
	}

	chave := strings.TrimSpace(digitado)
	if chave == "" {
		return "", fmt.Errorf("token da empresa é obrigatório para instalar o agente")
	}

	// Aviso, não bloqueio: o formato atual é "orion_" + 32 hex, mas travar a
	// instalação num formato serviria só para quebrar o dia em que o formato
	// mudar. Quem digitou errado descobre no primeiro check-in (401).
	if !strings.HasPrefix(chave, "orion_") {
		imprimirAviso("o token informado não começa com \"orion_\" — confira se copiou o token certo")
	}

	return chave, nil
}

// gerarConfigComChave parte do agent.yaml padrão embutido (configTemplate)
// e substitui só a linha da chave (e a da URL, se a config anexada trouxer
// uma diferente do padrão) — mantém comentários e o resto das opções
// (interval_seconds, metrics_port etc.) exatamente como o template já
// define, em vez de recriar o arquivo do zero.
func gerarConfigComChave(chave string, cfg *configAnexada) []byte {
	texto := string(configTemplate)
	texto = strings.Replace(texto, "agent_key: "+placeholderAgentKey, "agent_key: "+chave, 1)
	if cfg != nil && cfg.APIURL != "" {
		linhas := strings.Split(texto, "\n")
		for i, linha := range linhas {
			if strings.HasPrefix(strings.TrimSpace(linha), "api_url:") {
				linhas[i] = "api_url: " + cfg.APIURL
				break
			}
		}
		texto = strings.Join(linhas, "\n")
	}
	return []byte(texto)
}
