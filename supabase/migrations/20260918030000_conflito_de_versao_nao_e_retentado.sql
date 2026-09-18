-- =============================================================================
-- Conflito de versão deixa de usar o código de "tente de novo"
-- =============================================================================
--
-- O INCIDENTE (18/09/2026)
--
-- O banco ficou em 100% de CPU. A causa foram 100 chamadas por segundo a
-- assumir_chamado, todas falhando com "Conflito de concorrência", sem parar,
-- desde 11/09 às 21:18 — mais de 8 milhões de erros por dia.
--
-- Não havia cliente nenhum mandando essas chamadas. Eram duas requisições do
-- dia 11 — muito provavelmente um clique duplo em "Assumir" —, cada uma presa
-- em retentativa infinita DENTRO do servidor. As evidências:
--
--   * todos os erros vinham de exatamente duas conexões do PostgREST, as duas
--     abertas em 11/09 às 21:18. Requisições novas se espalhariam pelo pool;
--   * o token nas chamadas foi emitido às 21:08 de 11/09 e VENCEU às 22:08 do
--     mesmo dia, e mesmo assim seguia sendo aceito — porque não era requisição
--     nova, era a mesma reexecutada, e o token nunca foi revalidado;
--   * nenhuma dessas chamadas passava pela borda da API;
--   * fechar abas, reiniciar a máquina e sair da conta não mudaram nada;
--   * uma alteração temporária em assumir_chamado, feita para diagnóstico,
--     apareceu DENTRO do laço, o que só acontece se a função estiver sendo
--     reexecutada pelo servidor.
--
-- A CAUSA
--
-- Estas funções sinalizavam o conflito de versão com SQLSTATE 40001
-- (serialization_failure). No Postgres esse é o código de "falha transitória,
-- repita a transação", e a camada de banco do PostgREST repete
-- automaticamente transações que falham com ele.
--
-- Só que o conflito de versão NÃO é transitório: a requisição carrega um
-- updated_at antigo, e ele nunca mais vai bater, por mais vezes que se
-- repita. Falha determinística com código de retentativa automática é laço
-- infinito, e cada ocorrência prende uma conexão do pool para sempre.
--
-- Todo conflito de versão desde 11/09 podia ter iniciado um laço destes. Só não
-- aconteceu de novo porque conflitos são raros.
--
-- A CORREÇÃO
--
-- O conflito passa a sair como PT409. O PostgREST converte códigos no formato
-- PTxyz no status HTTP xyz, então o cliente recebe 409 Conflict — que é
-- exatamente o significado. E, por não ser da classe 40, não é retentado.
--
-- Como a função é resolvida de novo a cada reexecução, as duas requisições
-- presas recebem o 409 na volta seguinte do laço, terminam, e liberam as
-- conexões.
--
-- O frontend (src/hooks/useTickets.ts) reconhecia o conflito por '40001'; ele
-- passa a reconhecer 'PT409', mantendo '40001' por segurança.
--
-- O caminho "não encontrado ou sem permissão" (42501) não muda: é classe 42 e
-- nunca foi retentado.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.falhar_comando_chamado(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tickets WHERE id = p_ticket_id) THEN
    -- PT409, e não 40001: ver o cabeçalho deste arquivo.
    RAISE EXCEPTION 'Conflito de concorrência: o chamado foi modificado por outro técnico.'
      USING ERRCODE = 'PT409';
  END IF;
  RAISE EXCEPTION 'Chamado não encontrado ou sem permissão.'
    USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_chamado(
  p_ticket_id uuid,
  p_notes text,
  p_resolution_content text,
  p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS tickets
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.tickets;
BEGIN
  UPDATE public.tickets
  SET status           = 'resolved',
      resolution_notes = p_notes,
      resolved_at      = now()
  WHERE id = p_ticket_id
    AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.tickets WHERE id = p_ticket_id) THEN
      -- PT409, e não 40001: ver o cabeçalho deste arquivo.
      RAISE EXCEPTION 'Conflito de concorrência: o chamado foi modificado por outro técnico.'
        USING ERRCODE = 'PT409';
    END IF;
    RAISE EXCEPTION 'Chamado não encontrado ou sem permissão para resolvê-lo.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
  VALUES
    (p_ticket_id, 'Status alterado para: Resolvido', 'status_change', '', false),
    (p_ticket_id, p_resolution_content,              'comment',       '', false);

  RETURN v_ticket;
END;
$$;
