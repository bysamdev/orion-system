package monitor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/netip"
	"sort"
	"strings"
	"sync"
	"time"
)

// Links de internet dos clientes: o link principal (dedicado) e a redundância
// (Starlink ou internet comum). Tudo mora aqui, no servidor de monitoramento:
// o cadastro no banco do monitor, a medição em memória e o histórico no
// Prometheus. Nada vai para o Supabase.
//
// Três fontes de medição:
//  1. Ping de fora: o blackbox_exporter pinga o IP público de cada link. A
//     lista de alvos vem de /sd/links (service discovery do Prometheus).
//  2. Sonda: o agente do Orion no servidor do cliente. A cada heartbeat ele
//     recebe daqui os alvos que deve pingar e devolve latência, perda e o IP
//     público de saída — que diz qual link está em uso agora.
//  3. (próxima etapa) leitura do MikroTik e da antena Starlink pela sonda.

// Papéis e tipos aceitos no cadastro.
var (
	papeisDeLink = map[string]bool{"principal": true, "backup": true}
	tiposDeLink  = map[string]bool{"dedicado": true, "starlink": true, "internet": true}
)

// AlvosPadrao são pingados por toda sonda: medem a internet do link que está
// em uso, seja ele qual for.
var AlvosPadrao = []string{"1.1.1.1", "8.8.8.8"}

// validadeDaMedicao: sem medição nova da sonda nesse prazo, o link sai das
// métricas de latência/perda em vez de congelar no último valor. Servidor
// manda heartbeat a cada 60 s; 5 min são cinco perdidos.
const validadeDaMedicao = 5 * time.Minute

// Link é um link de internet cadastrado.
type Link struct {
	ID        string `json:"id"`
	CompanyID string `json:"company_id"`
	Cliente   string `json:"cliente"`
	Nome      string `json:"nome"`
	Papel     string `json:"papel"`
	Tipo      string `json:"tipo"`
	// IPPublico é o IP fixo do link: alvo do ping de fora e a forma de saber,
	// pelo IP de saída da sonda, que este é o link em uso. Starlink comum não
	// tem IP fixo e fica vazio.
	IPPublico string `json:"ip_publico"`
	// AlvoTeste é um IP que o roteador manda sempre por este link (rota de
	// teste). Com ele a sonda mede o link mesmo quando ele está parado.
	AlvoTeste string `json:"alvo_teste"`
	// SondaMachineID é o servidor do cliente que mede. Vazio: o servidor da
	// empresa que mandou heartbeat por último.
	SondaMachineID string    `json:"sonda_machine_id"`
	CriadoEm       time.Time `json:"criado_em"`
}

var errLinkInvalido = errors.New("link inválido")

// IPPublico precisa ser um IPv4 alcançável da internet. A sonda identifica
// o link comparando esse valor com seu IPv4 de saída; o Prometheus o usa como
// alvo de ICMP. Rejeitar redes internas evita sondar a infraestrutura local.
func ipv4Publico(s string) bool {
	ip, err := netip.ParseAddr(s)
	if err != nil || !ip.Is4() || !ip.IsGlobalUnicast() || ip.IsPrivate() {
		return false
	}
	for _, rede := range [...]netip.Prefix{
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("192.0.0.0/24"),
		netip.MustParsePrefix("192.0.2.0/24"),
		netip.MustParsePrefix("198.18.0.0/15"),
		netip.MustParsePrefix("198.51.100.0/24"),
		netip.MustParsePrefix("203.0.113.0/24"),
	} {
		if rede.Contains(ip) {
			return false
		}
	}
	return true
}

// Normalizar tira espaços e confere os campos. Não inventa valor: o que
// faltar é erro para quem cadastrou.
func (l *Link) Normalizar() error {
	l.CompanyID, l.Cliente, l.Nome = strings.TrimSpace(l.CompanyID), strings.TrimSpace(l.Cliente), strings.TrimSpace(l.Nome)
	l.Papel, l.Tipo = strings.ToLower(strings.TrimSpace(l.Papel)), strings.ToLower(strings.TrimSpace(l.Tipo))
	l.IPPublico, l.AlvoTeste, l.SondaMachineID = strings.TrimSpace(l.IPPublico), strings.TrimSpace(l.AlvoTeste), strings.TrimSpace(l.SondaMachineID)
	falha := func(msg string) error { return errors.Join(errLinkInvalido, errors.New(msg)) }
	switch {
	case !uuidValido.MatchString(l.CompanyID):
		return falha("company_id inválido")
	case l.Nome == "" || len(l.Nome) > 80:
		return falha("nome é obrigatório (até 80 caracteres)")
	case len(l.Cliente) > 120:
		return falha("cliente com mais de 120 caracteres")
	case !papeisDeLink[l.Papel]:
		return falha("papel deve ser principal ou backup")
	case !tiposDeLink[l.Tipo]:
		return falha("tipo deve ser dedicado, starlink ou internet")
	case l.IPPublico != "" && !ipv4Publico(l.IPPublico):
		return falha("ip_publico deve ser um IPv4 público fixo")
	case l.AlvoTeste != "" && net.ParseIP(l.AlvoTeste) == nil:
		return falha("alvo_teste deve ser um IP")
	case l.SondaMachineID != "" && !uuidValido.MatchString(l.SondaMachineID):
		return falha("sonda_machine_id inválido")
	}
	return nil
}

// TesteDeLink é o resultado de um ping feito pela sonda.
type TesteDeLink struct {
	Alvo       string  `json:"alvo"`
	LatenciaMs float64 `json:"latencia_ms"`
	JitterMs   float64 `json:"jitter_ms"`
	// PerdaPct 100 = nenhuma resposta.
	PerdaPct float64 `json:"perda_pct"`
}

// AmostraDeLinks é o que a sonda mede entre um heartbeat e outro.
type AmostraDeLinks struct {
	IPSaida string        `json:"ip_saida"`
	Testes  []TesteDeLink `json:"testes"`
}

// ConfigDaSonda vai na resposta do heartbeat: o que o agente deve medir.
type ConfigDaSonda struct {
	Alvos            []string `json:"alvos"`
	DescobrirIPSaida bool     `json:"descobrir_ip_saida"`
}

// EstadoDoLink é a última medição de um link pela sonda. Ponteiro nulo =
// não dá para saber (ex.: link de backup parado, sem rota de teste).
type EstadoDoLink struct {
	Ativo      *bool     `json:"ativo"`
	Up         *bool     `json:"up"`
	LatenciaMs *float64  `json:"latencia_ms"`
	JitterMs   *float64  `json:"jitter_ms"`
	PerdaPct   *float64  `json:"perda_pct"`
	MedidoEm   time.Time `json:"medido_em"`
}

func ptr[T any](v T) *T { return &v }

// resumir junta os testes de vários alvos: latência e jitter pela média dos
// que responderam, perda pela média de todos. Sem teste nenhum, nil.
func resumir(testes []TesteDeLink) (lat, jit, perda *float64) {
	if len(testes) == 0 {
		return nil, nil, nil
	}
	var somaLat, somaJit, somaPerda float64
	responderam := 0
	for _, t := range testes {
		somaPerda += t.PerdaPct
		if t.PerdaPct < 100 {
			somaLat += t.LatenciaMs
			somaJit += t.JitterMs
			responderam++
		}
	}
	perda = ptr(arredondar(somaPerda / float64(len(testes))))
	if responderam > 0 {
		lat = ptr(arredondar(somaLat / float64(responderam)))
		jit = ptr(arredondar(somaJit / float64(responderam)))
	}
	return lat, jit, perda
}

func arredondar(v float64) float64 { return math.Round(v*10) / 10 }

// AvaliarGrupo interpreta a medição de uma sonda para os links que ela mede.
//
// Link em uso: o que tem ip_publico igual ao IP de saída. Se nenhum bate e só
// um link não tem IP fixo (a Starlink, com IP que muda), é ele. Com um link
// só, ele é o ativo.
//
// Latência e perda: pela rota de teste do link, quando existe; senão, os
// alvos padrão medem o link ativo. Backup parado sem rota de teste fica sem
// medição por dentro (o ping de fora e a antena cobrem esse caso).
func AvaliarGrupo(links []Link, am *AmostraDeLinks, em time.Time) map[string]EstadoDoLink {
	out := make(map[string]EstadoDoLink, len(links))
	if am == nil || len(links) == 0 {
		return out
	}

	ativo := ""
	if am.IPSaida != "" {
		var semIP []string
		for _, l := range links {
			if l.IPPublico != "" && l.IPPublico == am.IPSaida {
				ativo = l.ID
			}
			if l.IPPublico == "" {
				semIP = append(semIP, l.ID)
			}
		}
		if ativo == "" && len(semIP) == 1 {
			ativo = semIP[0]
		}
	}
	if ativo == "" && len(links) == 1 {
		ativo = links[0].ID
	}

	porAlvo := map[string]TesteDeLink{}
	var padrao []TesteDeLink
	for _, t := range am.Testes {
		porAlvo[t.Alvo] = t
		for _, p := range AlvosPadrao {
			if t.Alvo == p {
				padrao = append(padrao, t)
			}
		}
	}

	for _, l := range links {
		e := EstadoDoLink{MedidoEm: em}
		if ativo != "" {
			e.Ativo = ptr(l.ID == ativo)
		}
		var lat, jit, perda *float64
		if t, ok := porAlvo[l.AlvoTeste]; ok && l.AlvoTeste != "" {
			lat, jit, perda = resumir([]TesteDeLink{t})
		} else if l.ID == ativo {
			lat, jit, perda = resumir(padrao)
		}
		if perda != nil {
			e.LatenciaMs, e.JitterMs, e.PerdaPct = lat, jit, perda
			e.Up = ptr(*perda < 100)
		}
		out[l.ID] = e
	}
	return out
}

// CadastroDeLinks é o que os links precisam do banco.
type CadastroDeLinks interface {
	ListarLinks(ctx context.Context) ([]Link, error)
	SalvarLink(ctx context.Context, l *Link) error
	ApagarLink(ctx context.Context, id string) error
}

// Links guarda o cadastro e a última medição de cada link em memória. O
// cadastro é pequeno (dezenas de links) e muda pouco; ler do banco a cada
// heartbeat seria desperdício.
type Links struct {
	Store CadastroDeLinks

	mu       sync.RWMutex
	cadastro []Link
	estados  map[string]EstadoDoLink
}

func NovosLinks(store CadastroDeLinks) *Links {
	return &Links{Store: store, estados: map[string]EstadoDoLink{}}
}

func (l *Links) Carregar(ctx context.Context) error {
	lista, err := l.Store.ListarLinks(ctx)
	if err != nil {
		return err
	}
	l.mu.Lock()
	l.cadastro = lista
	l.mu.Unlock()
	return nil
}

func (l *Links) Listar() []Link {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return append([]Link(nil), l.cadastro...)
}

func (l *Links) Estados() map[string]EstadoDoLink {
	l.mu.RLock()
	defer l.mu.RUnlock()
	out := make(map[string]EstadoDoLink, len(l.estados))
	for id, e := range l.estados {
		out[id] = e
	}
	return out
}

func (l *Links) Salvar(ctx context.Context, novo Link) (Link, error) {
	if err := novo.Normalizar(); err != nil {
		return Link{}, err
	}
	if err := l.Store.SalvarLink(ctx, &novo); err != nil {
		return Link{}, err
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	for i := range l.cadastro {
		if l.cadastro[i].ID == novo.ID {
			l.cadastro[i] = novo
			return novo, nil
		}
	}
	l.cadastro = append(l.cadastro, novo)
	return novo, nil
}

func (l *Links) Apagar(ctx context.Context, id string) error {
	if err := l.Store.ApagarLink(ctx, id); err != nil {
		return err
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	for i := range l.cadastro {
		if l.cadastro[i].ID == id {
			l.cadastro = append(l.cadastro[:i], l.cadastro[i+1:]...)
			break
		}
	}
	delete(l.estados, id)
	return nil
}

// linksDaSonda devolve os links que esta máquina mede. servidorDaEmpresa
// escolhe a sonda dos links que não têm uma definida.
func (l *Links) linksDaSonda(machineID string, servidorDaEmpresa func(companyID string) string) []Link {
	l.mu.RLock()
	defer l.mu.RUnlock()
	var out []Link
	for _, lk := range l.cadastro {
		sonda := lk.SondaMachineID
		if sonda == "" && servidorDaEmpresa != nil {
			sonda = servidorDaEmpresa(lk.CompanyID)
		}
		if sonda == machineID {
			out = append(out, lk)
		}
	}
	return out
}

// ConfigDaSonda: nil quando a máquina não mede nenhum link.
func (l *Links) ConfigDaSonda(machineID string, servidorDaEmpresa func(string) string) *ConfigDaSonda {
	links := l.linksDaSonda(machineID, servidorDaEmpresa)
	if len(links) == 0 {
		return nil
	}
	alvos := append([]string(nil), AlvosPadrao...)
	for _, lk := range links {
		if lk.AlvoTeste != "" && !contem(alvos, lk.AlvoTeste) {
			alvos = append(alvos, lk.AlvoTeste)
		}
	}
	return &ConfigDaSonda{Alvos: alvos, DescobrirIPSaida: true}
}

func contem(lista []string, v string) bool {
	for _, x := range lista {
		if x == v {
			return true
		}
	}
	return false
}

// RegistrarMedicao aplica a medição da sonda aos links dela.
func (l *Links) RegistrarMedicao(machineID string, am *AmostraDeLinks, em time.Time, servidorDaEmpresa func(string) string) {
	links := l.linksDaSonda(machineID, servidorDaEmpresa)
	if len(links) == 0 || am == nil {
		return
	}
	// Uma sonda pode medir links de mais de uma empresa só se alguém a
	// escolheu assim; o "link em uso" é decidido por empresa.
	porEmpresa := map[string][]Link{}
	for _, lk := range links {
		porEmpresa[lk.CompanyID] = append(porEmpresa[lk.CompanyID], lk)
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, grupo := range porEmpresa {
		for id, e := range AvaliarGrupo(grupo, am, em) {
			if atual, ok := l.estados[id]; ok && atual.MedidoEm.After(em) {
				continue
			}
			l.estados[id] = e
		}
	}
}

func rotulosDoLink(lk *Link) string {
	return fmt.Sprintf(`link_id="%s",company_id="%s",cliente="%s",nome="%s",papel="%s",tipo="%s"`,
		rotular(lk.ID), rotular(lk.CompanyID), rotular(lk.Cliente), rotular(lk.Nome), rotular(lk.Papel), rotular(lk.Tipo))
}

func boolParaNumero(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// Escrever produz as séries dos links para o /metrics.
func (l *Links) Escrever(w io.Writer, agora time.Time) {
	l.mu.RLock()
	cadastro := append([]Link(nil), l.cadastro...)
	estados := make(map[string]EstadoDoLink, len(l.estados))
	for id, e := range l.estados {
		estados[id] = e
	}
	l.mu.RUnlock()
	sort.Slice(cadastro, func(i, j int) bool {
		if cadastro[i].Cliente != cadastro[j].Cliente {
			return cadastro[i].Cliente < cadastro[j].Cliente
		}
		return cadastro[i].Nome < cadastro[j].Nome
	})

	fmt.Fprint(w, "# HELP orion_link_info Link de internet cadastrado (sempre 1)\n# TYPE orion_link_info gauge\n")
	for i := range cadastro {
		fmt.Fprintf(w, "orion_link_info{%s} 1\n", rotulosDoLink(&cadastro[i]))
	}

	type serieDeLink struct {
		nome, ajuda string
		valor       func(e *EstadoDoLink) *float64
	}
	seriesDeLink := []serieDeLink{
		{"orion_link_ativo", "1 se o link está em uso agora, pela sonda", func(e *EstadoDoLink) *float64 {
			if e.Ativo == nil {
				return nil
			}
			return ptr(boolParaNumero(*e.Ativo))
		}},
		{"orion_link_up", "1 se o link responde, medido de dentro do cliente", func(e *EstadoDoLink) *float64 {
			if e.Up == nil {
				return nil
			}
			return ptr(boolParaNumero(*e.Up))
		}},
		{"orion_link_latencia_ms", "Latência média do link em ms, pela sonda", func(e *EstadoDoLink) *float64 { return e.LatenciaMs }},
		{"orion_link_jitter_ms", "Variação da latência em ms, pela sonda", func(e *EstadoDoLink) *float64 { return e.JitterMs }},
		{"orion_link_perda_pct", "Perda de pacotes em porcentagem, pela sonda", func(e *EstadoDoLink) *float64 { return e.PerdaPct }},
		{"orion_link_medido_em_timestamp_seconds", "Momento da última medição pela sonda (unix)", func(e *EstadoDoLink) *float64 {
			return ptr(float64(e.MedidoEm.Unix()))
		}},
	}
	for _, s := range seriesDeLink {
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n", s.nome, s.ajuda, s.nome)
		for i := range cadastro {
			e, ok := estados[cadastro[i].ID]
			if !ok || agora.Sub(e.MedidoEm) > validadeDaMedicao {
				continue
			}
			if v := s.valor(&e); v != nil {
				fmt.Fprintf(w, "%s{%s} %g\n", s.nome, rotulosDoLink(&cadastro[i]), *v)
			}
		}
	}
}

// GrupoSD é um item do http_sd_configs do Prometheus.
type GrupoSD struct {
	Targets []string          `json:"targets"`
	Labels  map[string]string `json:"labels"`
}

// AlvosExternos: os links com IP público, para o ping de fora (blackbox).
func (l *Links) AlvosExternos() []GrupoSD {
	out := []GrupoSD{}
	for _, lk := range l.Listar() {
		if lk.IPPublico == "" {
			continue
		}
		out = append(out, GrupoSD{
			Targets: []string{lk.IPPublico},
			Labels: map[string]string{
				"link_id": lk.ID, "company_id": lk.CompanyID, "cliente": lk.Cliente,
				"nome": lk.Nome, "papel": lk.Papel, "tipo": lk.Tipo,
			},
		})
	}
	return out
}
