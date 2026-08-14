# Relatório de Auditoria: Segredos e Credenciais Expostas (Subagente 6)

## Escopo
Varredura em todo o código-fonte, histórico de commits recentes e arquivos `.env`.

## Achados

### [High] Credenciais Supabase Service Role em Variáveis de Ambiente
- **Arquivo:Linha**: `handler/main.go:35` e `supabase/functions/`
- **Descrição**: O backend utiliza `SUPABASE_SERVICE_ROLE_KEY` para operações administrativas. Confirmado que esta chave NÃO está vazada no bundle frontend (em `src/integrations/supabase/client.ts` é utilizada apenas a `anon_key` pública).
- **Recomendação**: Garantir que a `service_role` key esteja configurada exclusivamente no ambiente Vercel Serverless / Supabase Vault e nunca em `.env` versionados.

### [Low] Test Auth Fake Tokens em Desenvolvimento
- **Arquivo:Linha**: `src/contexts/AuthContext.tsx:50`
- **Descrição**: Existência de tokens de teste mockados (`access_token: 'test'`) quando a query string contém `?testAuth=1`.
- **Recomendação**: Manter a guarda estrita de `import.meta.env.DEV` para garantir que esse bypass nunca seja ativado em ambiente de produção compilado.

## RESUMO EXECUTIVO
- **Critical**: 0
- **High**: 1
- **Medium**: 0
- **Low**: 1
- **Total de Achados**: 2
