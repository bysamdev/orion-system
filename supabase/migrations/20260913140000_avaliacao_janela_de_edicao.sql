-- =================================================================================
-- Migration: 20260913140000_avaliacao_janela_de_edicao.sql
--
-- ticket_ratings não tinha policy de UPDATE nem de DELETE: nota errada não se
-- corrigia. Antes isso não aparecia porque nada gravava com sucesso visível
-- (ver 20260913110000). Com a avaliação funcionando, aparece na primeira vez
-- que alguém clica na estrela errada.
--
-- O autor passa a poder editar a própria avaliação por 15 minutos — a mesma
-- janela de ticket_updates, para não haver duas regras diferentes de "posso
-- corrigir o que acabei de escrever?" no mesmo produto.
--
-- ---------------------------------------------------------------------------
-- Por que a policy sozinha não basta
--
-- A janela é "created_at > now() - 15 min". Uma policy de UPDATE avalia o
-- WITH CHECK sobre a linha NOVA, e RLS não enxerga a linha antiga. Então uma
-- policy sozinha deixaria o autor gravar created_at = now() junto com a
-- edição: a linha nova passa no WITH CHECK, a janela reabre, e a "janela de
-- 15 minutos" vira edição eterna.
--
-- Quem fecha isso é o trigger abaixo, que devolve à linha nova os três campos
-- de identidade vindos da linha antiga:
--
--   created_at  senão a janela se renova sozinha
--   user_id     senão a avaliação muda de autor
--   ticket_id   senão a avaliação migra para outro chamado
--
-- É o mesmo desenho de set_ticket_update_author: o banco sobrescreve em vez
-- de recusar, então o cliente não precisa saber que esses campos existem.
--
-- ---------------------------------------------------------------------------
-- O que continua não podendo
--
-- DELETE: nenhuma policy. Apagar avaliação é apagar dado de satisfação; para
-- corrigir basta editar dentro da janela.
--
-- developer/admin editando avaliação alheia: deliberadamente de fora. Em
-- ticket_updates o developer edita qualquer entrada, e ali faz sentido — é
-- timeline operacional. Aqui é a opinião do cliente sobre o atendimento que a
-- própria equipe prestou. Equipe poder reescrever a nota que recebeu invalida
-- a métrica inteira, e a auditoria de quem avaliou o quê é justamente o dado
-- que o bloqueio de abertura de chamado passou a consumir.
--
-- Pular e depois avaliar de verdade continua possível dentro da janela: o
-- CHECK ticket_ratings_nota_ou_pulo mantém a coerência dos dois campos.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.preserva_identidade_da_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.created_at := OLD.created_at;
    NEW.user_id    := OLD.user_id;
    NEW.ticket_id  := OLD.ticket_id;
    RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.preserva_identidade_da_avaliacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_preserva_identidade_da_avaliacao ON public.ticket_ratings;
CREATE TRIGGER trg_preserva_identidade_da_avaliacao
    BEFORE UPDATE ON public.ticket_ratings
    FOR EACH ROW EXECUTE FUNCTION public.preserva_identidade_da_avaliacao();

-- USING e WITH CHECK escritos separadamente de propósito. São idênticos hoje,
-- mas deixar só o USING faz o Postgres reusá-lo como WITH CHECK por
-- implicitude — e foi exatamente esse atalho que escondeu a trava
-- anti-escalonamento de user_roles em 2026-09-11.
DROP POLICY IF EXISTS "ticket_ratings_update" ON public.ticket_ratings;

CREATE POLICY "ticket_ratings_update" ON public.ticket_ratings
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND created_at > now() - interval '15 minutes'
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND created_at > now() - interval '15 minutes'
  );
