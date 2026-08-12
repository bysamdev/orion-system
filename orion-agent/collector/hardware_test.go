package collector

import (
	"net"
	"os"
	"runtime"
	"strings"
	"testing"
	"time"
)

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
// B) (removida — ver token/token_test.go)
//
// Esta seção continha os testes de Payload.GenerateToken(), removida na correção
// A.6/B.5: a identidade da máquina deixou de ser derivada de hardware
// (MachineUUID|Hostname|MACs — instável conforme o estado da rede, achado
// confirmado nesta mesma suíte, e não-secreta, achado de
// SECURITY-AUTO-PROVISIONING.md §1.2) e passou a ser um segredo aleatório gerado
// uma única vez e persistido. A cobertura equivalente agora vive em
// token.GenerateRandomIdentity (token/token_test.go): determinismo virou
// "unicidade entre gerações" e as antigas colisões por serialização ambígua
// deixaram de ser aplicáveis, porque não há mais concatenação de campos.
// -----------------------------------------------------------------------------


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

// -----------------------------------------------------------------------------
// D) modeloDaCPU() e primeiroIPv4NaoLoopback() — correção B.7
//
// Antes desta correção, Collect() chamava cpu.Info() (WMI) e net.Interfaces()
// duas vezes cada coleta, para dados que ou são estáticos (modelo da CPU) ou já
// tinham sido obtidos no mesmo ciclo (lista de interfaces). Medido em
// PERFORMANCE.md §3.1: ~44 ms + ~82 ms desperdiçados por coleta.
// -----------------------------------------------------------------------------

// TestModeloDaCPU_EhConsistenteEntreChamadas garante que múltiplas chamadas
// devolvem o mesmo valor — é o contrato externo do cache (sync.Once), já que
// não dá para observar de fora se cpu.Info() foi chamado 1 ou N vezes.
func TestModeloDaCPU_EhConsistenteEntreChamadas(t *testing.T) {
	primeiro := modeloDaCPU()
	for i := 0; i < 20; i++ {
		if atual := modeloDaCPU(); atual != primeiro {
			t.Fatalf("modeloDaCPU() não é estável: chamada %d devolveu %q, esperado %q", i, atual, primeiro)
		}
	}
}

// TestModeloDaCPU_ConcorrenciaSemPanic exercita o sync.Once em paralelo — não
// prova ausência de data race sozinho (esta máquina não tem toolchain C para
// -race, ver IMPROVEMENT_PLAN.md B.4), mas pelo menos garante que chamadas
// concorrentes não corrompem o valor cacheado nem entram em pânico.
func TestModeloDaCPU_ConcorrenciaSemPanic(t *testing.T) {
	const goroutines = 16
	resultados := make([]string, goroutines)
	done := make(chan int, goroutines)

	for i := 0; i < goroutines; i++ {
		go func(idx int) {
			resultados[idx] = modeloDaCPU()
			done <- idx
		}(i)
	}
	for i := 0; i < goroutines; i++ {
		<-done
	}

	esperado := resultados[0]
	for i, r := range resultados {
		if r != esperado {
			t.Errorf("goroutine %d obteve %q, esperado %q (todas deveriam ver o mesmo valor cacheado)", i, r, esperado)
		}
	}
}

// TestPrimeiroIPv4NaoLoopback_ListaVaziaRetornaVazio cobre o caminho seguro
// com entrada vazia — não é possível construir net.Interface sintéticas com
// endereços fake sem uma abstração sobre Addrs() (método, não campo, resolvido
// via consulta ao SO pelo índice da interface), então a cobertura de
// filtragem por IP real já é feita indiretamente por
// TestCollect_IPEInterfacesConsistentes e TestPrimaryIP_FormatoEValidade.
func TestPrimeiroIPv4NaoLoopback_ListaVaziaRetornaVazio(t *testing.T) {
	if got := primeiroIPv4NaoLoopback(nil); got != "" {
		t.Errorf("primeiroIPv4NaoLoopback(nil) = %q, esperado \"\"", got)
	}
	if got := primeiroIPv4NaoLoopback([]net.Interface{}); got != "" {
		t.Errorf("primeiroIPv4NaoLoopback([]) = %q, esperado \"\"", got)
	}
}

// TestPrimaryIPEPrimeiroIPv4NaoLoopback_Concordam garante que os dois caminhos
// de código (primaryIP, que faz sua própria net.Interfaces(), e a extração
// usada por Collect() a partir de um snapshot já obtido) continuam
// concordando após a refatoração do B.7.
func TestPrimaryIPEPrimeiroIPv4NaoLoopback_Concordam(t *testing.T) {
	ifaces, err := net.Interfaces()
	if err != nil {
		t.Skipf("não foi possível enumerar interfaces neste ambiente: %v", err)
	}

	viaSnapshot := primeiroIPv4NaoLoopback(ifaces)
	viaPrimaryIP := primaryIP()

	if viaSnapshot != viaPrimaryIP {
		t.Errorf("primeiroIPv4NaoLoopback(snapshot) = %q diverge de primaryIP() = %q", viaSnapshot, viaPrimaryIP)
	}
}

// -----------------------------------------------------------------------------
// E) Collect() não pode mais bloquear por 1s — correção B.6
// -----------------------------------------------------------------------------

// TestCollect_NaoBloqueiaPorUmSegundo é o teste de regressão da correção B.6:
// antes, cpu.Percent(1*time.Second, false) sozinho já garantia que Collect()
// nunca terminava em menos de 1s (medido em PERFORMANCE.md §3.1: 1,0s de 1,13s
// de tempo de parede total, 88,7%). Com cpu.Percent(0, false) (não-bloqueante),
// uma coleta completa — incluindo host.Info, disco, rede — deveria terminar bem
// abaixo de 1s. O teto de 500ms dá margem para máquinas mais lentas sem deixar
// passar uma reintrodução do bloqueio de 1s.
func TestCollect_NaoBloqueiaPorUmSegundo(t *testing.T) {
	inicio := time.Now()
	if _, err := Collect(); err != nil {
		t.Skipf("Collect() indisponível neste ambiente: %v", err)
	}
	decorrido := time.Since(inicio)

	const teto = 500 * time.Millisecond
	if decorrido >= teto {
		t.Errorf("Collect() levou %v — esperado bem abaixo de %v; "+
			"possível regressão para cpu.Percent(1*time.Second, false) bloqueante (ver B.6)", decorrido, teto)
	}
}
