package lib

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed assets/installer/OrionInstaller.exe
var instaladorGenerico []byte

// instaladorMsi é o MSI genérico (um único build, reutilizável por
// qualquer empresa) — a personalização não vai dentro do arquivo, e sim em
// propriedades passadas na linha de comando do msiexec (AGENTKEY etc.), o
// jeito padrão de GPO/SCCM/Intune parametrizarem instalação por grupo/OU.
// Ver orion-agent/packaging/msi/OrionAgent.wxs e
// ComandoMsiexecPersonalizado abaixo.
//
//go:embed assets/installer/OrionAgent.msi
var instaladorMsi []byte

// instaladorGenericoHash identifica a versão do instalador genérico
// embutido neste binário — calculado uma vez no cold start (não por
// request) e usado como parte da chave de cache em CaminhoInstaladorCache,
// pra garantir que um redeploy com o agente corrigido invalide instaladores
// já cacheados no Storage automaticamente.
var instaladorGenericoHash = func() string {
	soma := sha256.Sum256(instaladorGenerico)
	return hex.EncodeToString(soma[:])[:12]
}()

// instaladorMsiHash identifica a versão do .msi embutido — mesmo papel do
// instaladorGenericoHash, mas pro caminho fixo (não por empresa) em que o
// MSI genérico é cacheado no Storage.
var instaladorMsiHash = func() string {
	soma := sha256.Sum256(instaladorMsi)
	return hex.EncodeToString(soma[:])[:16]
}()

// CaminhoInstaladorCache calcula um caminho determinístico e
// content-addressed pro instalador de uma empresa: mesma agent_key + apiURL
// + companyName + versão do instalador genérico sempre gera o mesmo nome de
// arquivo, permitindo pular o upload de ~16MB quando nada mudou desde a
// última geração (ver InstaladorExiste em supabase.go).
func CaminhoInstaladorCache(companyID, agentKey, apiURL, companyName string) (pasta, nomeArquivo string) {
	h := sha256.New()
	h.Write([]byte(instaladorGenericoHash + "|" + agentKey + "|" + apiURL + "|" + companyName))
	soma := hex.EncodeToString(h.Sum(nil))[:16]
	return companyID + "/", soma + ".exe"
}

// CaminhoMsiCache devolve o caminho fixo (não depende de empresa — o MSI é
// o mesmo pra todo mundo) do .msi genérico no Storage. O hash no nome só
// serve pra invalidar o cache sozinho quando o binário for reconstruído.
func CaminhoMsiCache() (pasta, nomeArquivo string) {
	return "generic/", instaladorMsiHash + ".msi"
}

// InstaladorMsiBytes devolve os bytes do .msi genérico embutido.
func InstaladorMsiBytes() []byte {
	return instaladorMsi
}

// ComandoMsiexecPersonalizado monta a linha de comando pronta pra colar num
// Script de Inicialização de GPO (ou campo de comando do SCCM/Intune):
// instala o MSI genérico já passando AGENTKEY/APIURL/COMPANYNAME da
// empresa como propriedades — é assim que o CustomAction em
// OrionAgent.wxs recebe a config (ver orion-agent/cmd/installer/main.go
// pras flags equivalentes no .exe).
func ComandoMsiexecPersonalizado(nomeArquivoMsi, agentKey, apiURL, companyName string) string {
	escapar := func(s string) string { return strings.ReplaceAll(s, `"`, "'") }
	return fmt.Sprintf(
		`msiexec /i %s AGENTKEY="%s" APIURL="%s" COMPANYNAME="%s" /quiet /norestart`,
		nomeArquivoMsi, escapar(agentKey), escapar(apiURL), escapar(companyName),
	)
}

// marcadorConfigInstalador precisa ser byte-a-byte idêntico ao definido em
// orion-agent/cmd/installer/selfconfig.go (módulo Go separado — não dá pra
// importar o tipo direto, então o formato é duplicado nos dois lados de
// propósito). Mudar aqui sem mudar lá quebra a leitura no instalador.
var marcadorConfigInstalador = []byte("ORIONINSTALLERCFGv1\x00")

// configInstaladorAnexada espelha orion-agent/cmd/installer/selfconfig.go:configAnexada.
type configInstaladorAnexada struct {
	AgentKey    string `json:"agent_key"`
	APIURL      string `json:"api_url,omitempty"`
	CompanyName string `json:"company_name,omitempty"`
}

// MontarInstaladorPersonalizado pega o instalador genérico já compilado
// (embutido neste binário) e cola a configuração da empresa no final —
// puro append de bytes, sem recompilar nada. Windows ignora dados extras
// depois do fim de um PE válido, então o .exe resultante roda normalmente;
// o instalador só sabe procurar esse marcador e ler o JSON que vem depois
// (ver selfconfig.go no módulo do agente).
func MontarInstaladorPersonalizado(agentKey, apiURL, companyName string) ([]byte, error) {
	payload, err := json.Marshal(configInstaladorAnexada{
		AgentKey:    agentKey,
		APIURL:      apiURL,
		CompanyName: companyName,
	})
	if err != nil {
		return nil, fmt.Errorf("montar configuração do instalador: %w", err)
	}

	tamanho := make([]byte, 4)
	binary.BigEndian.PutUint32(tamanho, uint32(len(payload)))

	var buf bytes.Buffer
	buf.Grow(len(instaladorGenerico) + len(marcadorConfigInstalador) + 4 + len(payload))
	buf.Write(instaladorGenerico)
	buf.Write(marcadorConfigInstalador)
	buf.Write(tamanho)
	buf.Write(payload)
	return buf.Bytes(), nil
}

// SanitizarNomeArquivo troca qualquer caractere que não seja seguro num
// SHA256Hex devolve o hash SHA-256 em hexadecimal — usado pra alimentar o
// "--hash=" do comando orion-install, que o agente confere antes de rodar
// qualquer coisa baixada (ver verifySHA256 em
// orion-agent/service/windows.go).
func SHA256Hex(dados []byte) string {
	soma := sha256.Sum256(dados)
	return hex.EncodeToString(soma[:])
}

// nome de arquivo do Windows (\/:*?"<>|) por "-" — nomes de empresa livres
// (ex.: "iBReady Ltda.") não podem ir direto pro Content-Disposition.
func SanitizarNomeArquivo(nome string) string {
	nome = strings.TrimSpace(nome)
	if nome == "" {
		return "empresa"
	}
	var b strings.Builder
	for _, r := range nome {
		switch {
		case r == '\\' || r == '/' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|':
			b.WriteRune('-')
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

// CompanyName busca o nome de exibição de uma empresa — usado só pra rotular
// o instalador gerado (nome do arquivo, texto no banner), nunca para
// autorização.
func (d *DB) CompanyName(ctx context.Context, companyID string) (string, error) {
	var name string
	err := d.pool.QueryRow(ctx, `SELECT name FROM public.companies WHERE id = $1`, companyID).Scan(&name)
	return name, err
}

// ActiveOrNewAPIKey devolve a chave ativa mais recente da empresa; se não
// existir nenhuma (empresa nova, ninguém gerou chave manualmente ainda),
// cria uma automaticamente — gerar um instalador não deveria exigir um
// passo manual anterior em "Gerenciar Chaves".
func (d *DB) ActiveOrNewAPIKey(ctx context.Context, companyID, userID string) (string, error) {
	var key string
	err := d.pool.QueryRow(ctx, `
SELECT key_value FROM public.api_keys
WHERE company_id = $1 AND is_active = true
ORDER BY created_at DESC LIMIT 1`, companyID).Scan(&key)
	if err == nil {
		return key, nil
	}

	novaChave, err := gerarChaveAPI()
	if err != nil {
		return "", fmt.Errorf("gerar nova chave: %w", err)
	}
	_, err = d.pool.Exec(ctx, `
INSERT INTO public.api_keys (company_id, user_id, key_value, label)
VALUES ($1, $2, $3, 'Gerada automaticamente para instalador')`,
		companyID, userID, novaChave)
	if err != nil {
		return "", fmt.Errorf("salvar nova chave: %w", err)
	}
	return novaChave, nil
}

// gerarChaveAPI segue o mesmo formato ("orion_" + 32 caracteres
// alfanuméricos) já usado pela geração manual em CompanyManagement.tsx —
// só que via crypto/rand em vez de Math.random(), mais adequado pra um
// segredo de autenticação.
func gerarChaveAPI() (string, error) {
	const alfabeto = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i, b := range buf {
		buf[i] = alfabeto[int(b)%len(alfabeto)]
	}
	return "orion_" + string(buf), nil
}
