# Auditoria do Realtime e das consultas periódicas — 23/09/2026

## Escopo e fonte dos números

Leituras do projeto Supabase `kcxwealimsfxqstoprdg`, painel de uso da organização e código do frontend. As estatísticas de `pg_stat_statements` são acumuladas desde o último reset, em 11/06/2026; os logs de requisição abaixo abrangem as últimas 24 horas. Esses intervalos não devem ser comparados como se fossem o mesmo período.

## Diagnóstico

- A publicação `supabase_realtime` contém somente `public.audit_log`. `machines` já havia sido retirada pela migration `20260902190000_remove_machines_from_realtime.sql`. `tickets`, `network_links` e `monitored_endpoints` também não estão publicados. A tabela `realtime.subscription` não tinha assinaturas de Postgres Changes ativas na medição.
- A consulta interna `realtime.list_changes` acumulou 1.643.298 execuções e 9.917 segundos de tempo total desde junho. Em uma amostra de 32 segundos houve cerca de 62 execuções, mesmo sem assinantes. Esse contador mede trabalho interno do banco, não mensagens faturáveis; a amostra correspondeu a aproximadamente 0,33 segundo de tempo agregado de banco.
- O painel de uso da organização no plano Free registrou 4 mensagens de Realtime de 2 milhões incluídas, pico de 5 conexões simultâneas de 200 incluídas e nenhum excedente. O painel agrega os projetos da organização, portanto não atribui as quatro mensagens exclusivamente ao Orion.
- Nos logs das últimas 24 horas, o bridge fez cerca de 5.745 chamadas a `get_all_monitoring_targets` e 5.744 a `update_telemetry_status`; são chamadas HTTP da API, não mensagens do Realtime. Houve 31 requisições de WebSocket no mesmo intervalo. O volume dessas chamadas deve ser investigado separadamente caso o objetivo seja reduzir tráfego geral ou CPU.
- O frontend abria canais `postgres_changes` para `machines`, `tickets`, `network_links` e `monitored_endpoints`, apesar de nenhuma dessas tabelas estar publicada. As telas já usam consulta periódica: monitoramento de máquinas em 180/300 segundos, endpoints e links em 15 segundos, filas de chamados em 120 segundos, portal do cliente em 10 segundos. O detalhe do chamado não tinha consulta periódica e precisava de uma ao remover seu canal.
- As políticas inspecionadas já envolvem `auth.uid()` e chamadas de papel em `SELECT`; o advisor de performance não reportou `auth_rls_initplan` nesta medição. O contador de 714 milhões citado no card não foi reproduzido como contagem de avaliações de política; há um contador cumulativo de rollbacks com ordem de grandeza semelhante, influenciado pelo incidente anterior de retentativas `40001`.

## Ação no código

Foram retirados os usos dos canais sem eventos nas páginas e os canais redundantes dos hooks de endpoints e links. O detalhe do chamado passa a atualizar chamado, comentários e histórico de status a cada 60 segundos. A presença entre usuários e o canal de `audit_log` continuam ativos. A publicação, o schema, as políticas RLS e a cadência do bridge não foram alterados.

## Limites e verificação posterior

A redução em conexões só poderá ser medida após a publicação do frontend e abertura das telas afetadas. A amostra de 32 segundos não prova que o custo interno de `list_changes` é sempre baixo, e o painel de uso agrega cinco projetos. Se houver nova proposta de mudança na publicação ou nas políticas, fazer uma nova leitura e pedir aprovação antes de aplicar, conforme a regra de trabalho do projeto.

Referências: [mensagens Realtime](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages), [conexões de pico](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).
