# Auditoria de espaço do PostgreSQL — Orion System

Data: 23/09/2026. Projeto Supabase: `kcxwealimsfxqstoprdg`.

## Escopo e método

Esta auditoria usou apenas consultas `SELECT` às estatísticas e aos catálogos do PostgreSQL, agregações de contagem/tamanho e leitura do código. Não houve alteração de dados, esquema, RLS, jobs ou configuração. Os tamanhos das relações incluem tabela, índices e dados auxiliares (como TOAST). As estimativas de linhas de `pg_stat_user_tables` podem divergir da contagem exata.

## Resultado principal

O banco `postgres` ocupa **74.468.499 bytes (71 MB exibidos pelo PostgreSQL)**. Isso representa aproximadamente 14% da cota gratuita de 500 MB do banco. A cota de 1 GB de arquivos do Supabase Storage é separada.

| Relação | Tamanho físico | Linhas estimadas | Observação |
| --- | ---: | ---: | --- |
| `public.audit_log` | 35.274.752 B (33,6 MiB) | 18.554 | 47% do tamanho total; 20.484 linhas em contagem exata posterior |
| `cron.job_run_details` | 7.856.128 B (7,5 MiB) | estatística indisponível | 29.752 execuções registradas |
| `public.machine_commands` | 5.914.624 B (5,6 MiB) | 491 | 491 linhas em contagem exata |
| `auth.audit_log_entries` | 1.122.304 B (1,1 MiB) | 2.913 | Gerenciado pela autenticação; não alterar diretamente |
| `public.machine_alerts` | 917.504 B (0,9 MiB) | 1.618 | Histórico de alertas |
| `public.rate_limit_counters` | 761.856 B (0,7 MiB) | 1.604 | Contadores de limite de requisições |

O esquema `public` soma 47.243.264 B, `cron` 7.905.280 B e `auth` 2.752.512 B. A soma das relações listadas não precisa fechar o total do banco: há outros esquemas, catálogos e overhead.

## O que está gerando o volume

1. **Auditoria:** 7.610 atualizações de `tickets` ocupam cerca de 18,5 MB em `old_data` + `new_data`; 12.524 atualizações de `companies`, cerca de 8,9 MB. O gatilho atual guarda o registro inteiro antes e depois de cada `UPDATE`. Nos sete dias anteriores à consulta, houve 956 atualizações de `tickets` registradas. As últimas atualizações de `companies` foram em 11/09, compatível com a correção de escritas repetidas documentada em `lib/db.go`. Não assumir que todas as atualizações recentes de chamados são redundantes sem comparar campos alterados e os processos que as causaram.
2. **Retenção de auditoria:** `cleanup_audit_logs()` remove registros acima de 90 dias e o cron `cleanup-old-logs-daily` está ativo às 03:00 UTC; as cinco últimas execuções consultadas tiveram status `succeeded`. Havia 19 linhas acima de 90 dias no instante da leitura, possivelmente inseridas antes da próxima execução. Como a maioria dos 20.484 registros é recente, a regra de 90 dias não produzirá redução substancial imediata. Alterar esse prazo exige decisão sobre necessidade de histórico.
3. **Histórico do cron:** `cron.job_run_details` contém 29.752 linhas desde 03/12/2025, 13.091 nos últimos sete dias. O job `mark-machines-offline`, que roda a cada minuto, produziu 1.440 registros nas últimas 24 horas; a configuração `cron.log_run` está ligada. Há 4.733 execuções acima de 90 dias (somando os jobs consultados). Não há evidência de regra própria de retenção para esse histórico. Antes de limpá-lo, confirmar necessidades operacionais e recurso suportado pelo Supabase/pg_cron.
4. **Comandos de máquinas:** as 491 linhas têm aproximadamente 238 KB de saída e 307 KB de texto de comando, mas a relação física ocupa 5,9 MB. Isso sugere medir espaço livre/bloat e histórico de reescritas antes de culpar compressão do conteúdo. As linhas consultadas têm datas de 20/08 a 19/09; nenhuma tinha mais de 90 dias.

## Compressão e manutenção

O projeto usa PostgreSQL 17.6 com `default_toast_compression=pglz` e `autovacuum=on`. Já existe compressão automática de valores grandes; mudar para LZ4 ou compactar JSON no aplicativo sem medir pode não reduzir o tamanho total e pode aumentar custo de leitura/manutenção. Em `audit_log`, a estimativa de linhas mortas era 563 (2,9% do total estimado), insuficiente para presumir grande ganho com reorganização física. `VACUUM FULL` bloqueia a tabela e `pg_repack` pode precisar de espaço temporário próximo ao dobro do alvo; nenhum dos dois foi executado.

## Melhor sequência de trabalho

1. Medir por alguns dias o crescimento diário de `audit_log`, `cron.job_run_details` e `machine_commands`, e classificar atualizações de chamados por campos efetivamente alterados sem expor dados de clientes.
2. Confirmar se o gatilho de auditoria deve gravar atualização quando só campos técnicos ou derivados mudam; preservar trilha de segurança e negócio. Documentar mudança mínima e testes antes de implementá-la.
3. Definir com Sam o prazo de retenção de auditoria e do histórico de execução do cron. Não remover histórico ou alterar jobs sem aprovação.
4. Comparar ganho previsto de reduzir eventos novos e retenção com o ganho de uma reorganização física. Fazer manutenção apenas se houver evidência de bloat relevante, espaço livre suficiente e janela de operação.
5. Acompanhar separadamente o uso do Storage de anexos e do PostgreSQL. Migrar anexos para R2 não altera estas tabelas.

## Ponto de decisão

O banco ainda tem margem considerável até 500 MB. **A prioridade não é ativar um compressor genérico; é controlar a geração de auditoria de chamados e a retenção de logs do cron, sem perder dados necessários.** Esta auditoria termina aqui. Qualquer exclusão, mudança de retenção, schema, RLS ou configuração depende de proposta revisável e aprovação explícita do Sam.

Referências: [limites de tamanho da Supabase](https://supabase.com/docs/guides/platform/database-size), [TOAST no PostgreSQL](https://www.postgresql.org/docs/current/storage-toast.html), [pg_repack na Supabase](https://supabase.com/docs/guides/database/extensions/pg_repack).
