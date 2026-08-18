package collector

import "testing"

func TestIdentidadeViaEnv(t *testing.T) {
	env := map[string]string{
		"USERDOMAIN": "CORP",
		"USERNAME":   "jsilva",
	}
	getenv := func(k string) string { return env[k] }

	dominio, usuario := identidadeViaEnv(getenv)
	if dominio != "CORP" || usuario != `CORP\jsilva` {
		t.Fatalf(`esperado CORP/CORP\jsilva, obtive %s/%s`, dominio, usuario)
	}
}

func TestIdentidadeViaEnvFallbackWorkgroup(t *testing.T) {
	getenv := func(k string) string { return "" }

	dominio, usuario := identidadeViaEnv(getenv)
	if dominio != "WORKGROUP" {
		t.Fatalf("esperado WORKGROUP quando nenhuma variável está definida, obtive %s", dominio)
	}
	if usuario != "" {
		t.Fatalf("esperado usuário vazio, obtive %s", usuario)
	}
}

func TestIdentidadeViaEnvUserFallback(t *testing.T) {
	env := map[string]string{"USER": "root"}
	getenv := func(k string) string { return env[k] }

	_, usuario := identidadeViaEnv(getenv)
	if usuario != "root" {
		t.Fatalf("esperado fallback para USER=root, obtive %s", usuario)
	}
}

func TestIdentidadeViaEnvUserdnsdomainFallback(t *testing.T) {
	env := map[string]string{"USERDNSDOMAIN": "corp.example.com"}
	getenv := func(k string) string { return env[k] }

	dominio, _ := identidadeViaEnv(getenv)
	if dominio != "corp.example.com" {
		t.Fatalf("esperado fallback para USERDNSDOMAIN, obtive %s", dominio)
	}
}

func TestFormatarUsuarioInterativo(t *testing.T) {
	tests := []struct {
		name       string
		userDomain string
		userName   string
		hostname   string
		expected   string
	}{
		{
			name:       "AD Domain User",
			userDomain: "CORP",
			userName:   "jsilva",
			hostname:   "DESKTOP-01",
			expected:   `CORP\jsilva`,
		},
		{
			name:       "Local Machine User",
			userDomain: "DESKTOP-01",
			userName:   "admin",
			hostname:   "DESKTOP-01",
			expected:   "admin",
		},
		{
			name:       "Workgroup User",
			userDomain: "WORKGROUP",
			userName:   "suporte",
			hostname:   "DESKTOP-01",
			expected:   "suporte",
		},
		{
			name:       "Already formatted with backslash",
			userDomain: "CORP",
			userName:   `CORP\jsilva`,
			hostname:   "DESKTOP-01",
			expected:   `CORP\jsilva`,
		},
		{
			name:       "Empty user",
			userDomain: "CORP",
			userName:   "",
			hostname:   "DESKTOP-01",
			expected:   "",
		},
		{
			name:       "Special NT SERVICE domain",
			userDomain: "NT SERVICE",
			userName:   "OrionAgent",
			hostname:   "DESKTOP-01",
			expected:   "OrionAgent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatarUsuarioInterativo(tt.userDomain, tt.userName, tt.hostname)
			if got != tt.expected {
				t.Errorf("formatarUsuarioInterativo(%q, %q, %q) = %q, esperado %q",
					tt.userDomain, tt.userName, tt.hostname, got, tt.expected)
			}
		})
	}
}

func TestObterDominioMaquinaNaoVazio(t *testing.T) {
	dom := obterDominioMaquina()
	if dom == "" {
		t.Error("obterDominioMaquina() não deve retornar string vazia")
	}
}
