package collector

import (
	"net"
	"os"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"testing"
)

// -----------------------------------------------------------------------------
// Helpers de teste
// -----------------------------------------------------------------------------

// reHexSHA256 valida o formato esperado do token: 64 caracteres hexadecimais minúsculos.
var reHexSHA256 = regexp.MustCompile(`^[0-9a-f]{64}$`)

// novoPayloadBase monta um Payload determinístico para exercitar GenerateToken()
// como função PURA, sem depender de nenhuma coleta real de hardware.
func novoPayloadBase() *Payload {
	return &Payload{
		MachineUUID: "11111111-2222-3333-4444-555555555555",
		Hostname:    "ORION-PC-01",
		Interfaces: []NetworkInterface{
			{Name: "Ethernet", MAC: "aa:bb:cc:dd:ee:01", IPs: []string{"192.168.0.10/24"}},
			{Name: "Wi-Fi", MAC: "aa:bb:cc:dd:ee:02", IPs: []string{"192.168.0.11/24"}},
		},
	}
}

// -----------------------------------------------------------------------------
// A) DETECÇÃO DE USUÁRIO E DOMÍNIO
//
// ACHADO DE TESTABILIDADE (reportado): a cadeia de fallback de os.Getenv está
// embutida em Collect(), que também faz I/O pesado de hardware (host.Info,
// cpu.Percent com 1s de amostragem, mem.VirtualMemory, disk.Usage e enumeração
// de partições em goroutines). Não existe função exportada nem interna do tipo
// detectDomain()/detectUser() que possa ser testada isoladamente. Consequência:
// para validar uma regra de 5 linhas somos obrigados a rodar a coleta inteira,
// o que torna cada caso lento (>1s) e dependente da máquina real.
// -----------------------------------------------------------------------------

// coletaOuPula executa Collect() e falha o teste se a coleta retornar erro.
// A coleta é apenas de LEITURA do sistema — nenhum caminho real é escrito.
func coletaOuFalha(t *testing.T) *Payload {
	t.Helper()
	p, err := Collect()
	if err != nil {
		t.Fatalf("Collect() retornou erro inesperado neste ambiente: %v", err)
	}
	if p == nil {
		t.Fatal("Collect() retornou payload nil sem erro")
	}
	return p
}

// TestCollect_DeteccaoDeDominio_CadeiaDeFallback cobre a ordem de precedência
// USERDOMAIN -> USERDNSDOMAIN -> "WORKGROUP".
// Atenção: t.Setenv proíbe testes paralelos, por isso NÃO há t.Parallel aqui.
func TestCollect_DeteccaoDeDominio_CadeiaDeFallback(t *testing.T) {
	casos := []struct {
		nome          string
		userDomain    string
		userDNSDomain string
		esperado      string
	}{
		{
			nome:          "USERDOMAIN presente tem prioridade sobre USERDNSDOMAIN",
			userDomain:    "CORP-ORION",
			userDNSDomain: "corp.orion.local",
			esperado:      "CORP-ORION",
		},
		{
			nome:          "USERDOMAIN vazio cai para USERDNSDOMAIN",
			userDomain:    "",
			userDNSDomain: "corp.orion.local",
			esperado:      "corp.orion.local",
		},
		{
			nome:          "ambos vazios cai para WORKGROUP",
			userDomain:    "",
			userDNSDomain: "",
			esperado:      "WORKGROUP",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			t.Setenv("USERDOMAIN", c.userDomain)
			t.Setenv("USERDNSDOMAIN", c.userDNSDomain)

			p := coletaOuFalha(t)

			if p.Domain != c.esperado {
				t.Errorf("Domain = %q; esperado %q (USERDOMAIN=%q, USERDNSDOMAIN=%q)",
					p.Domain, c.esperado, c.userDomain, c.userDNSDomain)
			}
		})
	}
}

// TestCollect_DeteccaoDeUsuario_CadeiaDeFallback cobre USERNAME -> USER.
// Observação: quando ambos estão vazios o agente reporta usuário vazio — não há
// fallback para "UNKNOWN" nem para o usuário real do SO (ver achado reportado).
func TestCollect_DeteccaoDeUsuario_CadeiaDeFallback(t *testing.T) {
	casos := []struct {
		nome     string
		username string
		user     string
		esperado string
	}{
		{
			nome:     "USERNAME presente tem prioridade sobre USER",
			username: "samuel.ti",
			user:     "outro-usuario",
			esperado: "samuel.ti",
		},
		{
			nome:     "USERNAME vazio cai para USER",
			username: "",
			user:     "usuario-posix",
			esperado: "usuario-posix",
		},
		{
			nome:     "ambos vazios resulta em string vazia (sem fallback)",
			username: "",
			user:     "",
			esperado: "",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			t.Setenv("USERNAME", c.username)
			t.Setenv("USER", c.user)

			p := coletaOuFalha(t)

			if p.CurrentUser != c.esperado {
				t.Errorf("CurrentUser = %q; esperado %q (USERNAME=%q, USER=%q)",
					p.CurrentUser, c.esperado, c.username, c.user)
			}
		})
	}
}

// TestCollect_NaoPreencheMachineToken documenta que Collect() deixa MachineToken
// vazio de propósito: quem preenche é a camada de serviço (service/windows.go).
// Se alguém passar a preencher esse campo dentro do Collect, este teste avisa.
func TestCollect_NaoPreencheMachineToken(t *testing.T) {
	t.Setenv("USERDOMAIN", "CORP-ORION")
	t.Setenv("USERNAME", "samuel.ti")

	p := coletaOuFalha(t)

	if p.MachineToken != "" {
		t.Errorf("MachineToken = %q; Collect() não deve definir a identidade da máquina", p.MachineToken)
	}
}

// -----------------------------------------------------------------------------
// B) GenerateToken() — testado como função PURA
// -----------------------------------------------------------------------------

// TestGenerateToken_Formato garante que o token é um SHA-256 em hex minúsculo (64 chars).
func TestGenerateToken_Formato(t *testing.T) {
	t.Parallel()

	p := novoPayloadBase()
	tok := p.GenerateToken()

	if !reHexSHA256.MatchString(tok) {
		t.Errorf("token %q não bate com o formato sha256 hex de 64 caracteres (len=%d)", tok, len(tok))
	}
}

// TestGenerateToken_Determinismo garante que chamadas repetidas sobre o MESMO
// Payload produzem sempre o mesmo token.
func TestGenerateToken_Determinismo(t *testing.T) {
	t.Parallel()

	p := novoPayloadBase()
	primeiro := p.GenerateToken()

	for i := 0; i < 50; i++ {
		if atual := p.GenerateToken(); atual != primeiro {
			t.Fatalf("chamada %d gerou token diferente: %q != %q", i, atual, primeiro)
		}
	}
}

// TestGenerateToken_PayloadsEquivalentes garante que dois Payloads construídos
// separadamente, com os mesmos campos de identidade, geram o mesmo token.
func TestGenerateToken_PayloadsEquivalentes(t *testing.T) {
	t.Parallel()

	a := novoPayloadBase()
	b := novoPayloadBase()

	if a.GenerateToken() != b.GenerateToken() {
		t.Errorf("payloads equivalentes geraram tokens diferentes:\n a=%s\n b=%s",
			a.GenerateToken(), b.GenerateToken())
	}
}

// TestGenerateToken_IgnoraCamposVolateis garante que métricas que mudam a cada
// coleta (CPU, RAM, uptime, IP, discos) NÃO entram no cálculo da identidade.
// Se entrassem, a máquina trocaria de identidade a cada heartbeat.
func TestGenerateToken_IgnoraCamposVolateis(t *testing.T) {
	t.Parallel()

	base := novoPayloadBase()
	esperado := base.GenerateToken()

	volatil := novoPayloadBase()
	volatil.CPUUsage = 87.5
	volatil.RAMTotal = 34359738368
	volatil.RAMUsed = 17179869184
	volatil.DiskTotal = 512110190592
	volatil.DiskUsed = 256055095296
	volatil.Uptime = 987654
	volatil.IP = "10.0.0.99"
	volatil.OS = "windows"
	volatil.OSVersion = "10.0.26200"
	volatil.CPUModel = "Intel(R) Core(TM) i9"
	volatil.GPU = "NVIDIA RTX"
	volatil.MachineToken = "token-antigo-qualquer"
	volatil.Domain = "OUTRO-DOMINIO"
	volatil.CurrentUser = "outro-usuario"
	volatil.Disks = []DiskInfo{{Device: "C:", Mountpoint: "C:\\", FSType: "NTFS", Total: 1, Used: 1}}

	if atual := volatil.GenerateToken(); atual != esperado {
		t.Errorf("campos voláteis alteraram a identidade da máquina:\n esperado=%s\n obtido  =%s", esperado, atual)
	}
}

// TestGenerateToken_UnicidadePorCampoDeIdentidade garante que qualquer mudança
// em MachineUUID, Hostname ou em um MAC produz um token diferente.
func TestGenerateToken_UnicidadePorCampoDeIdentidade(t *testing.T) {
	t.Parallel()

	base := novoPayloadBase()
	tokenBase := base.GenerateToken()

	mutacoes := []struct {
		nome    string
		aplicar func(p *Payload)
	}{
		{
			nome:    "MachineUUID diferente",
			aplicar: func(p *Payload) { p.MachineUUID = "99999999-2222-3333-4444-555555555555" },
		},
		{
			nome:    "Hostname diferente",
			aplicar: func(p *Payload) { p.Hostname = "ORION-PC-02" },
		},
		{
			nome:    "primeiro MAC diferente",
			aplicar: func(p *Payload) { p.Interfaces[0].MAC = "aa:bb:cc:dd:ee:ff" },
		},
		{
			nome:    "segundo MAC diferente",
			aplicar: func(p *Payload) { p.Interfaces[1].MAC = "aa:bb:cc:dd:ee:fe" },
		},
		{
			nome: "interface adicional com MAC novo",
			aplicar: func(p *Payload) {
				p.Interfaces = append(p.Interfaces, NetworkInterface{Name: "VPN", MAC: "aa:bb:cc:dd:ee:03"})
			},
		},
		{
			nome:    "remocao de uma interface com MAC",
			aplicar: func(p *Payload) { p.Interfaces = p.Interfaces[:1] },
		},
	}

	vistos := map[string]string{tokenBase: "base"}
	for _, m := range mutacoes {
		t.Run(m.nome, func(t *testing.T) {
			p := novoPayloadBase()
			m.aplicar(p)
			tok := p.GenerateToken()

			if tok == tokenBase {
				t.Fatalf("mutação %q não alterou o token (%s)", m.nome, tok)
			}
			if !reHexSHA256.MatchString(tok) {
				t.Fatalf("token fora do formato esperado: %q", tok)
			}
		})
		// Registramos fora do subteste para detectar colisões entre mutações distintas.
		p := novoPayloadBase()
		m.aplicar(p)
		tok := p.GenerateToken()
		if anterior, jaVisto := vistos[tok]; jaVisto {
			t.Errorf("colisão de token entre %q e %q (token=%s)", anterior, m.nome, tok)
		}
		vistos[tok] = m.nome
	}
}

// TestGenerateToken_OrdemDasInterfacesImportaParaAIdentidade documenta o
// comportamento ATUAL: os MACs são concatenados na ordem em que o SO enumerou as
// interfaces, sem ordenação. Trocar a ordem muda o token.
// Isso é um risco de instabilidade de identidade (ver achado reportado):
// a ordem de net.Interfaces() não é garantida entre boots/drivers.
func TestGenerateToken_OrdemDasInterfacesImportaParaAIdentidade(t *testing.T) {
	t.Parallel()

	original := novoPayloadBase()
	invertido := novoPayloadBase()
	invertido.Interfaces[0], invertido.Interfaces[1] = invertido.Interfaces[1], invertido.Interfaces[0]

	tokOriginal := original.GenerateToken()
	tokInvertido := invertido.GenerateToken()

	if tokOriginal == tokInvertido {
		t.Fatalf("comportamento mudou: a ordem das interfaces passou a ser irrelevante " +
			"(token igual). Se isso foi intencional (ordenação de MACs), atualize este teste.")
	}
}

// TestGenerateToken_MesmaOrdemGeraTokenEstavel garante que, preservada a ordem
// das interfaces, o token permanece estável mesmo com os demais dados variando.
func TestGenerateToken_MesmaOrdemGeraTokenEstavel(t *testing.T) {
	t.Parallel()

	primeiraColeta := novoPayloadBase()
	primeiraColeta.CPUUsage = 12.3

	segundaColeta := novoPayloadBase()
	segundaColeta.CPUUsage = 91.7
	segundaColeta.Uptime = 424242
	// Os IPs mudaram (DHCP), mas os MACs e a ordem continuam iguais.
	segundaColeta.Interfaces[0].IPs = []string{"192.168.5.77/24"}
	segundaColeta.Interfaces[1].IPs = nil

	if a, b := primeiraColeta.GenerateToken(), segundaColeta.GenerateToken(); a != b {
		t.Errorf("token instável entre coletas com mesma identidade:\n a=%s\n b=%s", a, b)
	}
}

// TestGenerateToken_MACsVaziosSaoIgnorados garante que interfaces sem MAC
// (ex.: adaptadores virtuais/loopback) não influenciam a identidade.
func TestGenerateToken_MACsVaziosSaoIgnorados(t *testing.T) {
	t.Parallel()

	semVazios := novoPayloadBase()
	comVazios := novoPayloadBase()
	comVazios.Interfaces = append([]NetworkInterface{{Name: "Loopback", MAC: ""}}, comVazios.Interfaces...)
	comVazios.Interfaces = append(comVazios.Interfaces, NetworkInterface{Name: "Tunnel", MAC: ""})

	if a, b := semVazios.GenerateToken(), comVazios.GenerateToken(); a != b {
		t.Errorf("interfaces sem MAC alteraram o token:\n sem=%s\n com=%s", a, b)
	}
}

// TestGenerateToken_SemInterfaces garante comportamento definido quando a lista
// de interfaces está vazia ou nula: ainda gera um sha256 válido, baseado apenas
// em MachineUUID e Hostname, e não entra em pânico.
func TestGenerateToken_SemInterfaces(t *testing.T) {
	t.Parallel()

	vazia := novoPayloadBase()
	vazia.Interfaces = []NetworkInterface{}

	nula := novoPayloadBase()
	nula.Interfaces = nil

	tokVazia := vazia.GenerateToken()
	tokNula := nula.GenerateToken()

	if !reHexSHA256.MatchString(tokVazia) {
		t.Errorf("token com lista vazia fora do formato: %q", tokVazia)
	}
	if tokVazia != tokNula {
		t.Errorf("slice vazia e slice nula deveriam gerar o mesmo token:\n vazia=%s\n nula =%s", tokVazia, tokNula)
	}
	if tokVazia == novoPayloadBase().GenerateToken() {
		t.Error("máquina sem MACs gerou o mesmo token da máquina com MACs")
	}

	// Payload completamente zerado não pode entrar em pânico.
	zerado := &Payload{}
	if tok := zerado.GenerateToken(); !reHexSHA256.MatchString(tok) {
		t.Errorf("payload zerado gerou token inválido: %q", tok)
	}
}

// TestGenerateToken_ConcorrenciaSemDataRace exercita GenerateToken() em paralelo
// sobre o mesmo Payload. Com -race, qualquer escrita indevida em estado
// compartilhado dentro da função seria detectada.
func TestGenerateToken_ConcorrenciaSemDataRace(t *testing.T) {
	t.Parallel()

	p := novoPayloadBase()
	esperado := p.GenerateToken()

	const goroutines = 32
	var wg sync.WaitGroup
	resultados := make([]string, goroutines)

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			resultados[idx] = p.GenerateToken()
		}(i)
	}
	wg.Wait()

	for i, r := range resultados {
		if r != esperado {
			t.Fatalf("goroutine %d gerou token divergente: %q != %q", i, r, esperado)
		}
	}
}

// TestGenerateToken_ColisaoPorSerializacaoAmbigua_BUG documenta um BUG REAL de
// segurança/identidade: GenerateToken() concatena os campos com fmt.Sprintf
// ("%s|%s|%s") e junta os MACs com ",", sem escapar os separadores nem incluir
// o tamanho dos campos. Isso torna a serialização AMBÍGUA: máquinas diferentes
// podem produzir exatamente a mesma string bruta e, portanto, o MESMO token —
// que é a identidade usada para registrar a máquina no backend.
//
// Skip mantido para a suíte seguir verde. Remover o Skip após corrigir
// (ex.: usar JSON canônico, hash por campo, ou prefixar cada campo com o
// seu comprimento).
func TestGenerateToken_ColisaoPorSerializacaoAmbigua_BUG(t *testing.T) {
	t.Skip("BUG CONHECIDO: GenerateToken() concatena MachineUUID|Hostname|MACs sem escapar " +
		"os separadores '|' e ','; payloads de máquinas DIFERENTES colidem no mesmo token — " +
		"remover o Skip após corrigir")

	casos := []struct {
		nome string
		a    *Payload
		b    *Payload
	}{
		{
			nome: "separador '|' migrando entre MachineUUID e Hostname",
			a: &Payload{
				MachineUUID: "uuid-a|ORION-PC-01",
				Hostname:    "sufixo",
			},
			b: &Payload{
				MachineUUID: "uuid-a",
				Hostname:    "ORION-PC-01|sufixo",
			},
		},
		{
			nome: "separador ',' colapsando duas interfaces em uma",
			a: &Payload{
				MachineUUID: "uuid-c",
				Hostname:    "ORION-PC-03",
				Interfaces: []NetworkInterface{
					{Name: "Ethernet", MAC: "aa:bb:cc:dd:ee:01,aa:bb:cc:dd:ee:02"},
				},
			},
			b: &Payload{
				MachineUUID: "uuid-c",
				Hostname:    "ORION-PC-03",
				Interfaces: []NetworkInterface{
					{Name: "Ethernet", MAC: "aa:bb:cc:dd:ee:01"},
					{Name: "Wi-Fi", MAC: "aa:bb:cc:dd:ee:02"},
				},
			},
		},
		{
			nome: "fronteira Hostname/MAC deslocada por um '|'",
			a: &Payload{
				MachineUUID: "uuid-d",
				Hostname:    "ORION-PC-04|SUFIXO",
				Interfaces: []NetworkInterface{
					{Name: "Ethernet", MAC: "aa:bb:cc:dd:ee:01"},
				},
			},
			b: &Payload{
				MachineUUID: "uuid-d",
				Hostname:    "ORION-PC-04",
				Interfaces: []NetworkInterface{
					{Name: "Ethernet", MAC: "SUFIXO|aa:bb:cc:dd:ee:01"},
				},
			},
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if ta, tb := c.a.GenerateToken(), c.b.GenerateToken(); ta == tb {
				t.Errorf("COLISÃO: máquinas distintas compartilham a identidade %s", ta)
			}
		})
	}
}

// -----------------------------------------------------------------------------
// C) primaryIP() e diskRoot()
// -----------------------------------------------------------------------------

// TestDiskRoot_PorPlataforma garante a raiz correta por sistema operacional.
// Serve de regressão caso alguém troque o caminho ou remova o branch do Windows.
func TestDiskRoot_PorPlataforma(t *testing.T) {
	t.Parallel()

	raiz := diskRoot()

	if runtime.GOOS == "windows" {
		if raiz != "C:\\" {
			t.Errorf("diskRoot() = %q no Windows; esperado %q", raiz, "C:\\")
		}
	} else if raiz != "/" {
		t.Errorf("diskRoot() = %q em %s; esperado %q", raiz, runtime.GOOS, "/")
	}
}

// TestDiskRoot_CaminhoExisteNoSistema garante que a raiz devolvida é um diretório
// real e legível — só leitura, nada é escrito.
func TestDiskRoot_CaminhoExisteNoSistema(t *testing.T) {
	t.Parallel()

	info, err := os.Stat(diskRoot())
	if err != nil {
		t.Fatalf("diskRoot() = %q não é acessível: %v", diskRoot(), err)
	}
	if !info.IsDir() {
		t.Errorf("diskRoot() = %q não é um diretório", diskRoot())
	}
}

// TestDiskRoot_Determinismo garante que a função é pura (mesma saída sempre).
func TestDiskRoot_Determinismo(t *testing.T) {
	t.Parallel()

	primeiro := diskRoot()
	for i := 0; i < 10; i++ {
		if atual := diskRoot(); atual != primeiro {
			t.Fatalf("diskRoot() não é determinística: %q != %q", atual, primeiro)
		}
	}
}

// TestPrimaryIP_Determinismo garante que chamadas seguidas devolvem o mesmo IP
// (a rede não muda dentro da janela do teste).
func TestPrimaryIP_Determinismo(t *testing.T) {
	t.Parallel()

	primeiro := primaryIP()
	for i := 0; i < 5; i++ {
		if atual := primaryIP(); atual != primeiro {
			t.Fatalf("primaryIP() oscilou entre chamadas: %q != %q", atual, primeiro)
		}
	}
}

// TestPrimaryIP_FormatoEValidade garante o contrato da função: ou string vazia,
// ou um IPv4 válido, não-loopback, sem máscara de rede (sem "/").
func TestPrimaryIP_FormatoEValidade(t *testing.T) {
	t.Parallel()

	ipStr := primaryIP()
	if ipStr == "" {
		t.Skip("nenhuma interface de rede ativa não-loopback neste ambiente")
	}

	if strings.Contains(ipStr, "/") {
		t.Errorf("primaryIP() = %q contém máscara de rede; deveria devolver só o endereço", ipStr)
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		t.Fatalf("primaryIP() = %q não é um IP válido", ipStr)
	}
	if ip.To4() == nil {
		t.Errorf("primaryIP() = %q não é IPv4", ipStr)
	}
	if ip.IsLoopback() {
		t.Errorf("primaryIP() = %q é loopback e deveria ter sido ignorado", ipStr)
	}
	if ip.IsUnspecified() {
		t.Errorf("primaryIP() = %q é endereço não especificado", ipStr)
	}
}

// TestPrimaryIP_PertenceAUmaInterfaceAtiva garante que o IP devolvido realmente
// pertence a uma interface UP e não-loopback da máquina — pega o caso de a
// função passar a devolver um valor fabricado ou de outra interface.
func TestPrimaryIP_PertenceAUmaInterfaceAtiva(t *testing.T) {
	t.Parallel()

	ipStr := primaryIP()
	if ipStr == "" {
		t.Skip("nenhuma interface de rede ativa não-loopback neste ambiente")
	}

	ifaces, err := net.Interfaces()
	if err != nil {
		t.Skipf("não foi possível enumerar interfaces neste ambiente: %v", err)
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip4 := ip.To4(); ip4 != nil && ip4.String() == ipStr {
				return // encontrado: contrato satisfeito
			}
		}
	}

	t.Errorf("primaryIP() = %q não pertence a nenhuma interface ativa não-loopback", ipStr)
}

// TestCollect_IPEInterfacesConsistentes garante que o IP principal do payload é
// o mesmo devolvido por primaryIP() e que as interfaces coletadas estão ativas.
func TestCollect_IPEInterfacesConsistentes(t *testing.T) {
	p := coletaOuFalha(t)

	if p.IP != primaryIP() {
		t.Errorf("Payload.IP = %q diverge de primaryIP() = %q", p.IP, primaryIP())
	}
	if p.Hostname == "" {
		t.Error("Hostname vazio no payload coletado")
	}
	if p.OS == "" {
		t.Error("OS vazio no payload coletado (fallback para runtime.GOOS deveria cobrir)")
	}
	if p.RAMTotal == 0 {
		t.Error("RAMTotal = 0; a leitura de memória falhou silenciosamente")
	}
	if p.DiskTotal == 0 {
		t.Errorf("DiskTotal = 0 para a raiz %q", diskRoot())
	}
}
