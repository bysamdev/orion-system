-- =============================================================================
-- Distinguir máquina recusada de máquina offline
-- =============================================================================
--
-- Em 17/09/2026 a chave de uma empresa foi rotacionada e uma máquina ficou 12
-- horas sem conseguir reportar. No painel ela aparecia apenas como offline — o
-- mesmo sintoma de um computador desligado —, e só se descobriu a causa lendo
-- os logs da Vercel (281 respostas 401).
--
-- Offline e recusada pedem ações opostas: a primeira costuma se resolver
-- sozinha; a segunda é configuração do nosso lado e não se resolve nunca.
--
-- O heartbeat recusado traz o machine_token no corpo. Quando o token é de uma
-- máquina já conhecida, o backend grava aqui o momento da recusa. O painel
-- mostra "recusada" quando essa data é mais recente que last_seen: assim que
-- a chave for corrigida e o próximo heartbeat passar, last_seen a ultrapassa
-- e o aviso some sozinho, sem precisar limpar a coluna.
--
-- Cuidados contra abuso, porque qualquer um que conheça a URL pode mandar
-- requisição recusada:
--   * só UPDATE de máquina existente, nunca INSERT: token desconhecido não
--     gera linha nenhuma;
--   * no máximo uma escrita por minuto por máquina (filtro no WHERE do Go);
--   * a chave enviada nunca é guardada.
-- =============================================================================

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS auth_recusada_em timestamptz;

COMMENT ON COLUMN public.machines.auth_recusada_em IS
  'Última vez que um heartbeat desta máquina foi recusado por chave inválida. '
  'Recusada de fato quando é mais recente que last_seen.';
