import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import {
  BUCKET, caminhoDeDescarteValido, caminhoNoBucket, envioRecente, idDeAnexoValido, naoEncontrado,
} from "./regras.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const responder = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Exclusão de anexo de chamado, registro e arquivo juntos.
 *
 * O navegador apagava só a linha de ticket_attachments e o arquivo ficava no
 * bucket. Ele também não conseguiria apagar o arquivo: a policy de DELETE do
 * Storage só vale para admin da empresa mãe e developer, enquanto a de
 * ticket_attachments deixa o admin da empresa cliente apagar.
 *
 * Ações (corpo JSON):
 * - { attachmentId }: apaga o registro COM A SESSÃO de quem chama (a RLS de
 *   ticket_attachments decide quem pode) e só então remove o arquivo com a
 *   chave de serviço. Se a remoção do arquivo falhar, o registro volta, para
 *   nenhum anexo sumir da tela deixando o arquivo para trás sem rastro.
 * - { descartarCaminho }: desfaz um upload cujo registro não chegou a ser
 *   gravado. Só apaga se o arquivo foi enviado por quem chama e nenhum anexo
 *   aponta para ele.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return responder(401, { error: 'Autenticação necessária' });

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const doUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await doUsuario.auth.getUser();
    if (authError || !user) return responder(401, { error: 'Autenticação necessária' });

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const corpo = await req.json().catch(() => null) as
      { attachmentId?: unknown; descartarCaminho?: unknown } | null;

    // ── Desfazer upload sem registro ──────────────────────────────────────
    if (typeof corpo?.descartarCaminho === 'string') {
      const caminho = caminhoNoBucket(corpo.descartarCaminho);
      if (!caminhoDeDescarteValido(caminho)) {
        return responder(400, { error: 'Caminho inválido' });
      }
      const [pasta, arquivo] = caminho.split('/');

      // Quem chama precisa enxergar o chamado da pasta (a RLS de tickets
      // decide), e o arquivo tem de ser recente: descarte é para o upload que
      // acabou de falhar, não para limpar arquivo antigo.
      const { data: chamado } = await doUsuario
        .from('tickets').select('id').eq('id', pasta).maybeSingle();
      if (!chamado) return responder(403, { error: 'Sem permissão' });

      const { data: lista, error: listError } = await admin.storage
        .from(BUCKET).list(pasta, { search: arquivo, limit: 10 });
      if (listError) return responder(500, { error: 'Não foi possível verificar o arquivo' });
      const objeto = (lista ?? []).find((o) => o.name === arquivo);
      if (!objeto) return responder(200, { success: true });
      if (!envioRecente(objeto.created_at)) {
        return responder(403, { error: 'Só é possível descartar um envio recente' });
      }

      const { count } = await admin
        .from('ticket_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('file_url', caminho);
      if ((count ?? 0) > 0) return responder(409, { error: 'Arquivo em uso por um anexo' });

      const { error } = await admin.storage.from(BUCKET).remove([caminho]);
      if (error && !naoEncontrado(error.message)) {
        console.error('Falha ao descartar upload:', error.message);
        return responder(500, { error: 'Não foi possível descartar o arquivo' });
      }
      return responder(200, { success: true });
    }

    // ── Excluir anexo ─────────────────────────────────────────────────────
    const attachmentId = corpo?.attachmentId;
    if (!idDeAnexoValido(attachmentId)) {
      return responder(400, { error: 'attachmentId inválido' });
    }

    // A RLS decide: sem permissão, nenhuma linha volta.
    const { data: apagados, error: delError } = await doUsuario
      .from('ticket_attachments')
      .delete()
      .eq('id', attachmentId)
      .select('*');
    if (delError) {
      console.error('Falha ao apagar registro do anexo:', delError.message);
      return responder(500, { error: 'Não foi possível excluir o anexo' });
    }
    const registro = apagados?.[0];
    if (!registro) return responder(404, { error: 'Anexo não encontrado ou sem permissão' });

    const caminho = caminhoNoBucket(registro.file_url);
    if (caminho) {
      const { error: stError } = await admin.storage.from(BUCKET).remove([caminho]);
      if (stError && !naoEncontrado(stError.message)) {
        console.error('Falha ao remover arquivo; registro restaurado:', stError.message);
        const { error: volta } = await admin.from('ticket_attachments').insert(registro);
        if (volta) console.error('Falha ao restaurar o registro do anexo:', volta.message);
        return responder(502, { error: 'Não foi possível remover o arquivo. Tente de novo.' });
      }
    }

    return responder(200, { success: true, ticketId: registro.ticket_id });
  } catch (e) {
    console.error('Erro inesperado:', e instanceof Error ? e.message : e);
    return responder(500, { error: 'Erro interno' });
  }
});
