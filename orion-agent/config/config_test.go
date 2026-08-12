package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// AVISO DE ESCOPO DESTE ARQUIVO DE TESTE
//
// config.Load() localiza o agent.yaml via os.Executable() e CRIA o arquivo com valores
// padrao caso ele nao exista. Nenhum teste aqui chama Load(): o caminho de escrita e
// derivado do binario em execucao e nao pode ser injetado, entao a funcao sempre escreve
// fora do controle do teste. Isso e um ACHADO DE TESTABILIDADE (ver comentario em
// TestLoadNaoEhTestavelSemInjecaoDeCaminho).
//
// O que e testado de verdade aqui:
//   - as tags YAML da struct Config (codigo de producao real, via yaml.Unmarshal)
//   - a constante defaultYAML embutida no binario (codigo de producao real)
//   - a logica de defaults e validacao, replicada em aplicarDefaultsEValidar abaixo
//     (LOGICA EQUIVALENTE, nao a funcao real — divergencias nao serao detectadas)

// aplicarDefaultsEValidar replica linha a linha o bloco final de config.Load
// (aplicacao de defaults + validacao de agent_key), operando sobre um caminho arbitrario.
// (A replica local de aplicarDefaultsEValidar foi removida na correcao A.7: a funcao
// passou a existir de verdade em config.go e os testes agora exercitam o codigo de
// producao, em vez de uma copia que podia divergir silenciosamente — foi exatamente
// essa divergencia que escondeu a falta de validacao de esquema da api_url.)

// carregarDoDisco escreve o YAML em t.TempDir(), le de volta e roda parsing + defaults.
// Espelha a sequencia de Load a partir do os.ReadFile — usando parsearYAML, a
// funcao real de producao (correcao B.13; antes replicava yaml.Unmarshal
// diretamente aqui, o que teria escondido a falta de KnownFields(true) do
// mesmo jeito que a replica de aplicarDefaultsEValidar escondeu a falta de
// validacao de esquema da api_url, ate a correcao A.7).
func carregarDoDisco(t *testing.T, yamlBruto string) (*Config, error) {
	t.Helper()

	caminho := filepath.Join(t.TempDir(), "agent.yaml")
	if err := os.WriteFile(caminho, []byte(yamlBruto), 0644); err != nil {
		t.Fatalf("preparacao falhou ao escrever %s: %v", caminho, err)
	}

	dados, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("preparacao falhou ao ler %s: %v", caminho, err)
	}

	cfg, err := parsearYAML(dados)
	if err != nil {
		return nil, err
	}
	if err := aplicarDefaultsEValidar(cfg, caminho); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

// TestYAMLValidoCompletoPreencheTodosOsCampos exercita as tags yaml REAIS da struct
// Config. Renomear qualquer tag (ex: api_url -> apiUrl) quebra este teste.
func TestYAMLValidoCompletoPreencheTodosOsCampos(t *testing.T) {
	const bruto = `api_url: https://orion.exemplo.local/api/heartbeat
agent_key: chave-secreta-123
interval_seconds: 30
log_file: orion.log
`

	cfg, err := carregarDoDisco(t, bruto)
	if err != nil {
		t.Fatalf("nao esperado erro, obtido: %v", err)
	}

	if cfg.APIURL != "https://orion.exemplo.local/api/heartbeat" {
		t.Errorf("APIURL = %q", cfg.APIURL)
	}
	if cfg.AgentKey != "chave-secreta-123" {
		t.Errorf("AgentKey = %q", cfg.AgentKey)
	}
	if cfg.IntervalSeconds != 30 {
		t.Errorf("IntervalSeconds = %d, esperado 30 (valor explicito nao pode ser sobrescrito pelo default)", cfg.IntervalSeconds)
	}
	if cfg.LogFile != "orion.log" {
		t.Errorf("LogFile = %q", cfg.LogFile)
	}
}

// TestYAMLMalformadoRetornaErro cobre o ramo "agent.yaml invalido".
func TestYAMLMalformadoRetornaErro(t *testing.T) {
	casos := map[string]string{
		"indentacao quebrada":      "api_url: https://x\n  agent_key: abc\n\tlog_file: y\n",
		"aspas nao fechadas":       `agent_key: "sem fechar` + "\n",
		"lista onde esperava mapa": "- api_url: https://x\n- agent_key: abc\n",
		"tipo errado em inteiro":   "agent_key: abc\ninterval_seconds: trinta\n",
		"tabulacao ilegal":         "agent_key:\tabc\n\tapi_url: https://x\n",
	}

	for nome, bruto := range casos {
		t.Run(nome, func(t *testing.T) {
			cfg, err := carregarDoDisco(t, bruto)
			if err == nil {
				t.Fatalf("esperado erro de parsing, obtido config %+v", cfg)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

// TestIntervalSecondsInvalidoViraSessenta cobre a regra cfg.IntervalSeconds <= 0 -> 60.
func TestIntervalSecondsInvalidoViraSessenta(t *testing.T) {
	casos := []struct {
		nome     string
		bruto    string
		esperado int
	}{
		{"campo ausente", "agent_key: abc\n", 60},
		{"zero explicito", "agent_key: abc\ninterval_seconds: 0\n", 60},
		{"negativo", "agent_key: abc\ninterval_seconds: -5\n", 60},
		{"valor valido preservado", "agent_key: abc\ninterval_seconds: 15\n", 15},
		{"valor alto preservado", "agent_key: abc\ninterval_seconds: 86400\n", 86400},
	}

	for _, caso := range casos {
		t.Run(caso.nome, func(t *testing.T) {
			cfg, err := carregarDoDisco(t, caso.bruto)
			if err != nil {
				t.Fatalf("nao esperado erro, obtido: %v", err)
			}
			if cfg.IntervalSeconds != caso.esperado {
				t.Errorf("IntervalSeconds = %d, esperado %d", cfg.IntervalSeconds, caso.esperado)
			}
		})
	}
}

// TestLogFileAusenteViraAgentLog cobre a regra cfg.LogFile == "" -> "agent.log".
func TestLogFileAusenteViraAgentLog(t *testing.T) {
	cfg, err := carregarDoDisco(t, "agent_key: abc\n")
	if err != nil {
		t.Fatalf("nao esperado erro, obtido: %v", err)
	}
	if cfg.LogFile != "agent.log" {
		t.Errorf("LogFile = %q, esperado %q", cfg.LogFile, "agent.log")
	}

	// log_file declarado vazio deve receber o mesmo tratamento.
	cfg, err = carregarDoDisco(t, "agent_key: abc\nlog_file: \"\"\n")
	if err != nil {
		t.Fatalf("nao esperado erro, obtido: %v", err)
	}
	if cfg.LogFile != "agent.log" {
		t.Errorf("log_file vazio: LogFile = %q, esperado %q", cfg.LogFile, "agent.log")
	}
}

// TestAPIURLAusenteRecebeDefault cobre a regra cfg.APIURL == "" -> URL base localhost.
//
// CORRIGIDO (item B.15): o default costumava ser a URL COMPLETA do endpoint de
// heartbeat, não a base — o que quebrava GetPortalURL/GetTicketURL e o atalho
// do Desktop, que concatenam "/api/auth/machine-login" direto em cima de
// cfg.APIURL. Ver config.go.
func TestAPIURLAusenteRecebeDefault(t *testing.T) {
	const esperado = "http://localhost:8080"

	cfg, err := carregarDoDisco(t, "agent_key: abc\n")
	if err != nil {
		t.Fatalf("nao esperado erro, obtido: %v", err)
	}
	if cfg.APIURL != esperado {
		t.Errorf("APIURL = %q, esperado %q", cfg.APIURL, esperado)
	}
}

// ---------------------------------------------------------------------------
// Validacao de seguranca do agent_key
// ---------------------------------------------------------------------------

// TestAgentKeyAusenteOuSentinelaEhErro cobre a validacao mais importante do pacote:
// o agente nao pode subir sem uma chave real configurada.
func TestAgentKeyAusenteOuSentinelaEhErro(t *testing.T) {
	casos := map[string]string{
		"campo ausente":            "api_url: https://orion.exemplo.local\n",
		"string vazia":             "agent_key: \"\"\napi_url: https://orion.exemplo.local\n",
		"valor sentinela":          "agent_key: COLOQUE_SUA_CHAVE_AQUI\n",
		"sentinela entre aspas":    "agent_key: \"COLOQUE_SUA_CHAVE_AQUI\"\n",
		"arquivo totalmente vazio": "",
		"apenas comentarios":       "# nada configurado aqui\n",
	}

	for nome, bruto := range casos {
		t.Run(nome, func(t *testing.T) {
			cfg, err := carregarDoDisco(t, bruto)
			if err == nil {
				t.Fatalf("esperado erro de agent_key nao configurada, obtido config %+v", cfg)
			}
			if !strings.Contains(err.Error(), "agent_key") {
				t.Errorf("mensagem de erro nao menciona agent_key: %v", err)
			}
		})
	}
}

// TestAgentKeyPreenchidaEhAceita e o contra-teste: sem ele, a validacao acima poderia
// estar rejeitando tudo e ainda assim "passar".
func TestAgentKeyPreenchidaEhAceita(t *testing.T) {
	cfg, err := carregarDoDisco(t, "agent_key: chave-de-verdade\n")
	if err != nil {
		t.Fatalf("nao esperado erro, obtido: %v", err)
	}
	if cfg.AgentKey != "chave-de-verdade" {
		t.Errorf("AgentKey = %q", cfg.AgentKey)
	}
}

// TestDefaultYAMLEmbutidoEhRejeitadoPelaValidacao valida a constante REAL defaultYAML:
// o arquivo que Load cria sozinho na primeira execucao precisa continuar sendo recusado,
// senao o agente subiria com a chave de exemplo. Testa produto real, nao replica.
//
// Usa parsearYAML (nao mais yaml.Unmarshal direto) para tambem garantir, de
// quebra, que o template embutido continua compativel com KnownFields(true)
// (correcao B.13) — se algum dia alguem adicionar um campo ao template sem
// que ele exista na struct Config, este teste falha aqui em vez de silenciar.
func TestDefaultYAMLEmbutidoEhRejeitadoPelaValidacao(t *testing.T) {
	cfg, err := parsearYAML([]byte(defaultYAML))
	if err != nil {
		t.Fatalf("defaultYAML embutido nao e um YAML valido: %v", err)
	}

	if cfg.AgentKey != "COLOQUE_SUA_CHAVE_AQUI" {
		t.Errorf("defaultYAML.agent_key = %q, esperado a sentinela %q", cfg.AgentKey, "COLOQUE_SUA_CHAVE_AQUI")
	}
	if cfg.IntervalSeconds != 60 {
		t.Errorf("defaultYAML.interval_seconds = %d, esperado 60", cfg.IntervalSeconds)
	}
	if cfg.LogFile != "agent.log" {
		t.Errorf("defaultYAML.log_file = %q, esperado agent.log", cfg.LogFile)
	}

	if err := aplicarDefaultsEValidar(cfg, "agent.yaml"); err == nil {
		t.Fatal("o agent.yaml gerado por padrao deveria ser REJEITADO pela validacao, mas foi aceito")
	}
}

// ---------------------------------------------------------------------------
// Achados de seguranca documentados
// ---------------------------------------------------------------------------

// TestAPIURLNaoHTTPSEhRejeitada cobre a correcao A.7: Load passou a exigir https://
// para qualquer destino remoto. Antes desta correcao um agent.yaml com "http://" era
// aceito silenciosamente e a agent_key (credencial de longa duracao) trafegava em texto
// claro em cada heartbeat.
//
// Este teste era o inverso — documentava a AUSENCIA da validacao — e foi invertido junto
// com a correcao, conforme instruia seu proprio comentario.
func TestAPIURLNaoHTTPSEhRejeitada(t *testing.T) {
	casos := []string{
		"http://orion.bysam.dev/api/heartbeat",
		"http://192.168.0.10:8080/api/heartbeat",
		"ftp://servidor/heartbeat",
		"nem-sequer-uma-url",
	}

	for _, endereco := range casos {
		t.Run(endereco, func(t *testing.T) {
			_, err := carregarDoDisco(t, "agent_key: chave-real\napi_url: "+endereco+"\n")
			if err == nil {
				t.Fatalf("api_url %q deveria ser rejeitada por nao usar https://", endereco)
			}
		})
	}
}

// TestAPIURLHTTPSEhAceita garante que a validacao de A.7 nao rejeita o caminho legitimo.
func TestAPIURLHTTPSEhAceita(t *testing.T) {
	const endereco = "https://orion.bysam.dev/api/heartbeat"

	cfg, err := carregarDoDisco(t, "agent_key: chave-real\napi_url: "+endereco+"\n")
	if err != nil {
		t.Fatalf("api_url https valida foi rejeitada: %v", err)
	}
	if cfg.APIURL != endereco {
		t.Fatalf("APIURL = %q, esperado %q", cfg.APIURL, endereco)
	}
}

// TestAPIURLHTTPEmLoopbackEhAceita cobre a excecao deliberada da correcao A.7:
// http:// continua permitido para localhost/127.0.0.1/::1, porque o trafego nao
// atravessa a rede e isso mantem o desenvolvimento local viavel.
func TestAPIURLHTTPEmLoopbackEhAceita(t *testing.T) {
	casos := []string{
		"http://localhost:8080/api/heartbeat",
		"http://127.0.0.1:8080/api/heartbeat",
	}

	for _, endereco := range casos {
		t.Run(endereco, func(t *testing.T) {
			if _, err := carregarDoDisco(t, "agent_key: chave-real\napi_url: "+endereco+"\n"); err != nil {
				t.Fatalf("loopback %q deveria ser aceito em http: %v", endereco, err)
			}
		})
	}
}

// TestCampoComTypoEhRejeitado cobre a correcao B.13: parsearYAML agora usa
// yaml.Decoder com KnownFields(true). Antes, um erro de digitacao em api_url
// (ex.: "api_urlx") passava despercebido e o agente caia no default
// localhost — um typo convertia silenciosamente um endpoint https de
// producao em http local, sem erro nem aviso. Agora falha alto, na
// inicializacao, apontando para o campo desconhecido.
func TestCampoComTypoEhRejeitado(t *testing.T) {
	const bruto = `agent_key: chave-real
api_urlx: https://orion.exemplo.local/api/heartbeat
intervalo_segundos: 15
`

	_, err := carregarDoDisco(t, bruto)
	if err == nil {
		t.Fatal("agent.yaml com campo desconhecido (api_urlx) deveria falhar, nao foi rejeitado")
	}
	if !strings.Contains(err.Error(), "api_urlx") {
		t.Errorf("erro %q nao menciona o campo desconhecido — dificulta o diagnostico pelo tecnico", err.Error())
	}
}

// TestCampoConhecidoContinuaAceito garante que a correcao B.13 (KnownFields)
// nao rejeita campos legitimos por engano — so os desconhecidos.
func TestCampoConhecidoContinuaAceito(t *testing.T) {
	const bruto = `agent_key: chave-real
api_url: https://orion.exemplo.local
interval_seconds: 15
log_file: custom.log
`

	cfg, err := carregarDoDisco(t, bruto)
	if err != nil {
		t.Fatalf("agent.yaml só com campos conhecidos foi rejeitado: %v", err)
	}
	if cfg.APIURL != "https://orion.exemplo.local" || cfg.IntervalSeconds != 15 || cfg.LogFile != "custom.log" {
		t.Errorf("campos conhecidos não foram preenchidos corretamente: %+v", cfg)
	}
}

// ---------------------------------------------------------------------------
// Achado de testabilidade
// ---------------------------------------------------------------------------

// TestLoadNaoEhTestavelSemInjecaoDeCaminho registra por que a funcao Load em si nao e
// exercitada nesta suite.
//
// Load resolve o diretorio via os.Executable() e, se agent.yaml nao existir la, CRIA o
// arquivo. Sob `go test` o binario fica em um diretorio temporario de build, mas o
// caminho nao e controlado pelo teste: em `go test -c`, `go test -o`, execucao do binario
// compilado a partir da raiz do repositorio ou instalacao do agente, a mesma chamada
// escreveria um agent.yaml ao lado do executavel — potencialmente dentro do repositorio
// do usuario ou em C:\Program Files. Alem disso Load nao tem como ser levada a falhar de
// forma deterministica, e imprime em stdout.
//
// Refatoracao minima sugerida: extrair `LoadFrom(path string) (*Config, error)` (ou
// tornar o resolvedor de caminho uma variavel de pacote sobrescrivivel), deixando Load()
// como um wrapper fino que so descobre o caminho e delega.
func TestLoadNaoEhTestavelSemInjecaoDeCaminho(t *testing.T) {
	t.Skip("ACHADO DE TESTABILIDADE: config.Load() escreve agent.yaml ao lado do executavel e nao aceita injecao de caminho — remover o Skip apos extrair LoadFrom(path)")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() falhou: %v", err)
	}
	if cfg.IntervalSeconds <= 0 {
		t.Errorf("IntervalSeconds invalido: %d", cfg.IntervalSeconds)
	}
}
