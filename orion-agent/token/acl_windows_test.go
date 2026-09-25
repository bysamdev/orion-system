package token

import (
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
	esperados := map[string]bool{"SY": false, "BA": false, "IU": false, usuarioSID: false}
	for _, match := range aceDaACL.FindAllStringSubmatch(sddl, -1) {
		campos := strings.Split(match[1], ";")
		if len(campos) != 6 || campos[0] != "A" {
			t.Fatalf("entrada de ACL inesperada: %q em %s", match[1], sddl)
		}
		principal := campos[5]
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
}
