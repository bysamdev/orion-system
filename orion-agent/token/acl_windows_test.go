package token

import (
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

var aceDaACL = regexp.MustCompile(`\(([^()]*)\)`)

// TestSaveTokenTo_RestringeACLDoDiretorio lê a ACL pela API nativa do Windows.
// O PowerShell pode estar instalado sem o módulo Microsoft.PowerShell.Security.
func TestSaveTokenTo_RestringeACLDoDiretorio(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "OrionAgent")
	if err := salvarTokenEm(filepath.Join(dir, "machine.token"), "token-qualquer"); err != nil {
		t.Fatalf("salvarTokenEm falhou: %v", err)
	}

	sd, err := windows.GetNamedSecurityInfo(dir, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatalf("ler ACL do diretório: %v", err)
	}
	sddl := sd.String()
	if sddl == "" {
		t.Fatal("não foi possível converter a ACL para SDDL")
	}
	if !strings.Contains(sddl, "D:P") {
		t.Fatalf("ACL ainda permite herança: %s", sddl)
	}
	usuario, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		t.Fatalf("obter SID do usuário: %v", err)
	}
	usuarioSID := usuario.User.Sid.String()
	sidServico, err := obterSIDDoServico()
	if err != nil {
		t.Fatalf("obter SID do serviço: %v", err)
	}
	servicoRegistrado := exec.Command("sc.exe", "query", "OrionAgent").Run() == nil
	esperados := map[string]bool{"SY": false, "BA": false, "IU": false, usuarioSID: false}
	if servicoRegistrado {
		esperados[sidServico] = false
	}
	for _, match := range aceDaACL.FindAllStringSubmatch(sddl, -1) {
		campos := strings.Split(match[1], ";")
		if len(campos) != 6 || campos[0] != "A" {
			t.Fatalf("entrada de ACL inesperada: %q em %s", match[1], sddl)
		}
		principal := campos[5]
		// No runner Windows, o SID da conta Administrator termina em -500 e
		// o SDDL o abrevia como LA (Local Administrator).
		if principal == "LA" && strings.HasSuffix(usuarioSID, "-500") {
			principal = usuarioSID
		}
		if _, ok := esperados[principal]; !ok {
			t.Errorf("ACL concede acesso inesperado a %s: %s", principal, sddl)
			continue
		}
		esperados[principal] = true
		if principal == "IU" {
			if campos[2] != "0x1200a9" && campos[2] != "GRGX" {
				t.Errorf("INTERACTIVE deve ter apenas leitura e execução: %s", match[1])
			}
		} else if campos[2] != "FA" {
			t.Errorf("%s deve ter acesso total: %s", principal, match[1])
		}
	}
	for principal, encontrado := range esperados {
		if !encontrado {
			t.Errorf("ACL não concede acesso a %s: %s", principal, sddl)
		}
	}
	arquivo := filepath.Join(dir, "machine.token")
	sdArquivo, err := windows.GetNamedSecurityInfo(arquivo, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatalf("ler ACL do arquivo: %v", err)
	}
	if servicoRegistrado && !strings.Contains(sdArquivo.String(), ";;;"+sidServico+")") {
		t.Errorf("arquivo da identidade não concede acesso ao serviço: %s", sdArquivo.String())
	}
}

func TestGarantirPermissoesEm_ReparaArquivoExistente(t *testing.T) {
	if exec.Command("sc.exe", "query", "OrionAgent").Run() != nil {
		t.Skip("a conta virtual só pode ser concedida após registrar o serviço")
	}
	path := filepath.Join(t.TempDir(), "OrionAgent", "machine.token")
	if err := saveNewTokenTo(path, "identidade-preservada"); err != nil {
		t.Fatal(err)
	}
	sidServico, err := obterSIDDoServico()
	if err != nil {
		t.Fatal(err)
	}
	// Simula uma instalação antiga com DACL explícita que exclui a conta do
	// serviço. O teste só modifica o arquivo temporário.
	for _, args := range [][]string{{path, "/inheritance:d"}, {path, "/remove:g", "*" + sidServico}} {
		if out, err := exec.Command("icacls", args...).CombinedOutput(); err != nil {
			t.Fatalf("simular ACL antiga: %v (%s)", err, out)
		}
	}
	antes, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(antes.String(), ";;;"+sidServico+")") {
		t.Fatalf("a simulação ainda permite o serviço: %s", antes.String())
	}
	if err := garantirPermissoesEm(path); err != nil {
		t.Fatalf("reparar ACL: %v", err)
	}
	depois, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(depois.String(), ";;;"+sidServico+")") {
		t.Errorf("ACL reparada ainda nega o serviço: %s", depois.String())
	}
	identidade, err := loadTokenFrom(path)
	if err != nil || identidade != "identidade-preservada" {
		t.Fatalf("a identidade mudou após reparar ACL: %q, %v", identidade, err)
	}
}
