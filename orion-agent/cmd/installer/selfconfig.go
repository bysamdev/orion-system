package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
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

// configAnexada é o que o backend embute — o suficiente para pular todo o
// fluxo manual de "edite o agent.yaml e rode install de novo".
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
	if strings.TrimSpace(cfg.AgentKey) == "" {
		return nil, fmt.Errorf("configuração anexada sem agent_key")
	}
	return &cfg, nil
}

// gerarConfigComChave parte do agent.yaml padrão embutido (configTemplate)
// e substitui só a linha da chave (e a da URL, se a config anexada trouxer
// uma diferente do padrão) — mantém comentários e o resto das opções
// (interval_seconds, metrics_port etc.) exatamente como o template já
// define, em vez de recriar o arquivo do zero.
func gerarConfigComChave(cfg *configAnexada) []byte {
	texto := string(configTemplate)
	texto = strings.Replace(texto, "agent_key: "+placeholderAgentKey, "agent_key: "+cfg.AgentKey, 1)
	if cfg.APIURL != "" {
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
