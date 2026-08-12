//go:build windows

package token

import (
	"fmt"
	"os/exec"
	"os/user"
)

// endurecerACLDoDiretorio restringe leitura e escrita de dir a SYSTEM, ao grupo
// Administradores e à conta que está criando o diretório agora, removendo a ACL
// herdada do diretório pai.
//
// Isso é necessário mesmo com o conteúdo protegido por DPAPI: o escopo usado em
// protect/unprotect é CRYPTPROTECT_LOCAL_MACHINE (obrigatório, porque o agente
// roda tanto como serviço SYSTEM quanto sob qualquer usuário interativo — ver
// protect_windows.go), e um blob nesse escopo pode ser decifrado por QUALQUER
// principal local, não apenas por quem o criou. Sem restringir quem consegue
// sequer LER o arquivo, um usuário sem privilégios continuaria conseguindo
// reconstruir o token só com CryptUnprotectData — exatamente o cenário já
// confirmado empiricamente para o ACL padrão de C:\ProgramData em
// SECURITY-AUTO-PROVISIONING.md §1.3 (leitura liberada para BUILTIN\Usuários).
//
// A conta atual precisa entrar na lista de concessão: quando o agente roda em
// modo tray interativo (main.go, clique do usuário — não o serviço SYSTEM), o
// processo grava neste mesmo diretório sob a identidade de um usuário comum, que
// nem sempre é administrador — e mesmo quando é, o UAC costuma filtrar o token
// do processo para não incluir os privilégios de Administradores enquanto não
// houver elevação explícita. Sem esta concessão dinâmica, restringir a ACL só a
// SYSTEM+Administradores quebraria a gravação/leitura do token em qualquer
// sessão interativa não elevada — o próprio processo que acabou de criar o
// diretório ficaria sem acesso a ele.
//
// Limitação aceita conscientemente: se a MESMA máquina rodar o agente sob duas
// contas de usuário diferentes em momentos distintos (por exemplo, dois técnicos
// testando manualmente, um depois do outro), só a conta que criou o diretório
// primeiro (mais SYSTEM/Administradores) consegue reutilizá-lo — a segunda conta
// falha ao salvar e o ciclo tenta de novo no próximo tick (ver o tratamento de
// erro em service/windows.go tick()). O caminho oficial de implantação
// (serviço Windows via GPO, sempre como SYSTEM) não é afetado por essa
// limitação.
//
// O grupo Administradores é referenciado pelo SID bem-conhecido S-1-5-32-544 em
// vez do nome ("Administradores"/"Administrators"), porque o nome muda conforme o
// idioma de instalação do Windows e um icacls com o nome errado falharia
// silenciosamente em máquinas localizadas. A conta atual, ao contrário, é
// referenciada pelo nome (DOMÍNIO\usuário) — nomes de conta não são localizados
// como nomes de grupo embutido são.
func endurecerACLDoDiretorio(dir string) error {
	concessoes := []string{
		`SYSTEM:(OI)(CI)F`,
		`*S-1-5-32-544:(OI)(CI)F`, // BUILTIN\Administrators
	}

	if u, err := user.Current(); err == nil && u.Username != "" {
		concessoes = append(concessoes, u.Username+`:(OI)(CI)F`)
	}
	// Se user.Current() falhar (raro, mas já reportado em alguns contextos de
	// serviço), seguimos só com SYSTEM+Administradores — não é motivo para
	// abortar o endurecimento inteiro.

	args := append([]string{dir, "/inheritance:r", "/grant:r"}, concessoes...)

	out, err := exec.Command("icacls", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("icacls falhou ao endurecer %q: %w (saída: %s)", dir, err, string(out))
	}
	return nil
}
