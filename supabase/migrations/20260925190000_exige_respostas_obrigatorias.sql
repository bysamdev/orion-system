-- O formulário de abertura já exige as perguntas obrigatórias na tela; esta
-- trava repete a regra no banco para quem cria chamado direto pela API.
-- Só vale para usuários logados (role authenticated): chamados automáticos do
-- monitoramento entram pela API Go com outra role e não têm formulário.
-- Mantenha a lista igual a src/lib/perguntasPorCategoria.ts (rótulos exatos).
CREATE OR REPLACE FUNCTION public.perguntas_obrigatorias_da_categoria(p_categoria text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_categoria
    WHEN 'erp' THEN ARRAY['O que você precisa realizar?', 'Qual mensagem aparece ou o que está errado neste processo?', 'Em qual empresa e filial a situação acontece?', 'Em qual módulo ou tela do sistema?', 'Quando você precisa concluir esta operação? Justifique o prazo.']
    WHEN 'email' THEN ARRAY['O que está acontecendo com o e-mail?', 'Qual endereço de e-mail está com o problema?', 'Onde você usa esse e-mail?']
    WHEN 'hardware' THEN ARRAY['O que está acontecendo com o equipamento?', 'Qual é o equipamento?', 'Desde quando o problema acontece?', 'O equipamento liga normalmente?', 'Você já tentou reiniciar?']
    WHEN 'software' THEN ARRAY['O que você precisa ou o que está acontecendo?', 'Qual programa?', 'É a instalação de um programa novo?', 'Já tentou fechar o programa ou reiniciar o computador?']
    WHEN 'rede' THEN ARRAY['O que está acontecendo?', 'O que está sem acesso?', 'Afeta só você ou outras pessoas também?']
    WHEN 'criacao_usuario' THEN ARRAY['Em quais sistemas o acesso precisa ser criado?', 'Nome completo da pessoa', 'Setor e cargo', 'A partir de quando o acesso precisa estar pronto?']
    WHEN 'impressora' THEN ARRAY['O que está acontecendo com a impressora?', 'Qual impressora ou em que local ela fica?', 'Afeta só você ou outras pessoas também?', 'Já desligou e religou a impressora?']
    WHEN 'outros' THEN ARRAY['O que você precisa?']
  END
$function$;

CREATE OR REPLACE FUNCTION public.exige_respostas_obrigatorias()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_faltando text[];
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;

  SELECT array_agg(p) INTO v_faltando
    FROM unnest(public.perguntas_obrigatorias_da_categoria(NEW.category)) AS p
   WHERE NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements(coalesce(NEW.metadata #> '{formulario,respostas}', '[]'::jsonb)) r
      WHERE r->>'pergunta' = p AND length(btrim(coalesce(r->>'resposta', ''))) > 0
   );

  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Responda as perguntas obrigatórias: %', array_to_string(v_faltando, '; ')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.exige_respostas_obrigatorias() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_exige_respostas_obrigatorias ON public.tickets;
CREATE TRIGGER trg_exige_respostas_obrigatorias
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.exige_respostas_obrigatorias();
