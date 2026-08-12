package collector

import "testing"

func TestIdentidadeViaEnv(t *testing.T) {
	env := map[string]string{
		"USERDOMAIN": "CORP",
		"USERNAME":   "jsilva",
	}
	getenv := func(k string) string { return env[k] }

	dominio, usuario := identidadeViaEnv(getenv)
	if dominio != "CORP" || usuario != "jsilva" {
		t.Fatalf("esperado CORP/jsilva, obtive %s/%s", dominio, usuario)
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
