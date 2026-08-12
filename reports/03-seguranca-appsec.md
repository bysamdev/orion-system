# Relatório de Auditoria de Segurança (AppSec) - Orion System

**Data:** Agosto de 2026
**Escopo:** Autenticação, Tokens, Vulnerabilidades (XSS, SQLi, CORS), Análise Estática de RLS (Supabase) e Backend (Go)

## Sumário Executivo
A auditoria revelou vulnerabilidades críticas e de alto risco na infraestrutura do Orion System. O backend em Go apresenta injeção de SQL autenticada (SQLi) e falhas no gerenciamento de CORS, enquanto as políticas de Row Level Security (RLS) do Supabase possuem regras excessivamente permissivas que possibilitam a escalonamento de privilégios e a manipulação de comandos de máquinas e artigos da base de conhecimento por qualquer usuário autenticado.

---

## 1. Injeção de SQL (SQLi) Dinâmica no Backend (Risco: Crítico)
**Localização:** `lib/monitoring.go` (`UpdateMachine` e `UpdateMachineGroup`)
**Descrição:**
As funções que atualizam dados de máquinas e grupos recebem um `map[string]any` cujo conteúdo vem diretamente do parse do JSON via `json.NewDecoder(r.Body).Decode(&updates)` (em `handler/mon_handlers.go`). As chaves deste mapa (fornecidas pelo usuário) são concatenadas diretamente na string SQL usando `fmt.Sprintf("%s = $%d", k, i)`, burlando o benefício dos _prepared statements_ que protegem apenas os valores.
**Exemplo de Exploração:**
Um payload contendo `{"name = 'hack' --": "value"}` modificará completamente a query gerada.
**Correção Recomendada:**
Fazer _allow-list_ das chaves/colunas permitidas para atualização e rejeitar quaisquer chaves que não existam no schema, ou utilizar um ORM / query builder seguro (ex: `squirrel`).

---

## 2. Quebra de Controle de Acesso e RLS Inseguro (Risco: Alto)
A análise profunda das migrações do Supabase (diretório `supabase/migrations/`) revelou que certas políticas concedem controle global utilizando a cláusula `USING (true)` para qualquer usuário autenticado (`TO authenticated`).
**Localizações Vulneráveis:**
- **`machine_commands`** (Migração: `20260321000300_master_monitoring_repair.sql`):
  `CREATE POLICY "Global manage for commands" ON public.machine_commands FOR ALL TO authenticated USING (true);`
  **Impacto:** Permite que qualquer usuário autenticado crie, modifique ou exclua comandos destinados aos Orion Agents, abrindo brechas para a execução arbitrária e sabotagem de equipamentos.
- **`knowledge_articles`** (Migração: `20260314070000_add_knowledge_base.sql`):
  `CREATE POLICY "Authenticated users can manage articles" ON public.knowledge_articles FOR ALL TO authenticated USING (true);`
  **Impacto:** Qualquer usuário pode alterar, publicar ou deletar artigos oficiais do Knowledge Base, o que pode ser utilizado para desinformação ou phishing interno.

**Correção Recomendada:**
Restringir as políticas de gerenciamento. Substituir `USING (true)` por verificações da função baseada em papéis (ex: `has_role(auth.uid(), 'admin'::app_role)`).

---

## 3. Má Configuração de CORS (Risco: Alto)
**Localização:** `handler/router.go` (`corsMiddleware`)
**Descrição:**
O middleware de CORS espelha cegamente qualquer origem que venha no header `Origin` da requisição e, simultaneamente, permite o tráfego de credenciais.
```go
origin := r.Header.Get("Origin")
if origin == "" { origin = "*" }
w.Header().Set("Access-Control-Allow-Origin", origin)
w.Header().Set("Access-Control-Allow-Credentials", "true")
```
**Impacto:**
A ausência de validação de origens permite que sites de terceiros maliciosos realizem requisições Cross-Origin autenticadas contra a API.
**Correção Recomendada:**
Criar uma _allow-list_ restrita (ex: `https://seu-dominio.com`) para validar o conteúdo de `Origin` antes de espelhá-lo nos headers de resposta.

---

## 4. Open Redirect (Risco: Médio)
**Localização:** `handler/auth_handlers.go` (`machineLogin`)
**Descrição:**
O endpoint de login via agente (passwordless) valida a query string `redirect_to` apenas verificando se ela começa com a barra `/`:
```go
if redirectTo == "" || !strings.HasPrefix(redirectTo, "/") {
    redirectTo = "/"
}
```
**Impacto:**
Um atacante pode contornar essa validação fornecendo uma URL protocolo-relativa, como `//evil-site.com`. Isso gerará um Magic Link que, quando clicado, enviará a vítima para fora da aplicação.
**Correção Recomendada:**
Fazer parsing adequado da URI ou validar com uma Regex rigorosa garantindo que começa com `/` mas que não seja seguida por outra `/` (excluir `//`).

---

## 5. Exposição e Armazenamento do Token da Máquina (Risco: Médio)
**Localização:** `src/pages/Auth.tsx`
**Descrição:**
- O front-end faz uma requisição HTTP direta sem TLS para `http://127.0.0.1:8081/token` para tentar detectar o Orion Agent. Se o serviço do Agente na porta 8081 estiver mal protegido ou sem CORS rígido, páginas maliciosas visitadas pelo usuário poderão obter a identidade daquela máquina local.
- O token extraído (`orion_machine_token`) é salvo em `localStorage`.
**Impacto:**
Caso surja uma vulnerabilidade de XSS na aplicação React, os atacantes poderão exfiltrar o token da máquina.
**Correção Recomendada:**
Revisar as políticas de segurança do Orion Agent e garantir que não permita CORS para outras origens além da aplicação principal. Avaliar a necessidade estrita desse token residir no `localStorage`.

---

## Conclusão
A prioridade número um é corrigir o **SQL Injection** em `lib/monitoring.go` e remover as permissões globais excessivas (`USING (true)`) no Supabase, particularmente para a tabela `machine_commands`, pois ela permite comprometimento potencial dos hosts (Agents) da rede. Modificar a gestão do CORS mitigará vetores comuns de exploração baseados no lado do cliente.
