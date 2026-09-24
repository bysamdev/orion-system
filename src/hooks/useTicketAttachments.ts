import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeOrionFunction } from '@/lib/orion-functions';

/**
 * Desfaz um upload cujo registro em ticket_attachments não foi gravado, para
 * o arquivo não ficar órfão no bucket. Best-effort: se falhar, só registra.
 */
export async function descartarUpload(caminho: string): Promise<void> {
  const { error } = await invokeOrionFunction('excluir-anexo', { descartarCaminho: caminho });
  if (error) console.warn('[anexos] Não foi possível descartar o upload órfão:', error.message);
}
import { useToast } from '@/hooks/use-toast';
import { comprimirImagem } from '@/lib/comprimirImagem';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
  disponibilidade?: 'disponivel' | 'ausente' | 'indisponivel';
}

export const statusDoAnexo = (codigo?: string | number): TicketAttachment['disponibilidade'] =>
  String(codigo) === '404' ? 'ausente' : 'indisponivel';

/**
 * Extrai o caminho relativo no storage a partir de um file_url.
 * Suporta caminhos relativos (armazenamento novo) e URLs completas de signed/public URL do Supabase (retrocompatibilidade).
 */
export const getStoragePath = (fileUrl: string): string | null => {
  if (!fileUrl) return null;

  let candidate: string | null = null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    candidate = fileUrl;
  } else {
    try {
      const urlObj = new URL(fileUrl);
      const pathname = urlObj.pathname;
      const bucketMarker = '/ticket-files/';
      const index = pathname.indexOf(bucketMarker);
      if (index !== -1) {
        const extracted = pathname.substring(index + bucketMarker.length);
        candidate = decodeURIComponent(extracted);
      }
    } catch {
      // URL inválida ou formato inesperado
    }
  }

  if (!candidate) return null;
  // Previne Directory / Path Traversal
  if (candidate.includes('..') || candidate.includes('\\')) {
    return null;
  }
  return candidate.replace(/^\/+/, '');
};

export const useTicketAttachments = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-attachments', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const attachmentsWithSignedUrls = await Promise.all(
        data.map(async (attachment) => {
          const rawUrl = attachment.file_url;
          const storagePath = getStoragePath(rawUrl);

          if (storagePath) {
            try {
              const { error: infoError } = await supabase.storage
                .from('ticket-files')
                .info(storagePath);
              if (infoError) {
                return { ...attachment, disponibilidade: statusDoAnexo(infoError.statusCode) };
              }

              const { data: urlData, error: signError } = await supabase.storage
                .from('ticket-files')
                .createSignedUrl(storagePath, 60 * 60 * 24);

              if (!signError && urlData?.signedUrl) {
                return {
                  ...attachment,
                  file_url: urlData.signedUrl,
                  disponibilidade: 'disponivel' as const
                };
              }
              return { ...attachment, disponibilidade: statusDoAnexo(signError?.statusCode) };
            } catch (err) {
              console.error('Erro ao gerar signed URL para anexo:', attachment.id, err);
            }
          }

          return { ...attachment, disponibilidade: 'indisponivel' as const };
        })
      );

      return attachmentsWithSignedUrls as TicketAttachment[];
    },
    enabled: !!ticketId
  });
};

export const useUploadAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      ticketId, 
      file: original
    }: { 
      ticketId: string; 
      file: File;
    }) => {
      const file = await comprimirImagem(original);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Allowlist de extensão -- defesa em profundidade além do
      // allowed_mime_types do bucket (que confia no Content-Type
      // declarado pelo client e pode ser forjado fora do browser).
      const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];
      const fileExt = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
        throw new Error(`Tipo de arquivo não permitido: .${fileExt}`);
      }

      // Gerar nome único para o arquivo
      const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from('ticket-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Salvar referência no banco armazenando o caminho relativo limpo
      const { data, error } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          file_name: file.name,
          file_url: fileName,
          file_type: file.type,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (error) {
        // O arquivo já subiu: sem o registro ele vira órfão no bucket.
        await descartarUpload(fileName);
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-attachments', variables.ticketId] });
      toast({
        title: 'Arquivo enviado',
        description: 'O arquivo foi anexado com sucesso.',
      });
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
    }
  });
};

export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ attachmentId, ticketId }: { attachmentId: string; ticketId: string }) => {
      // Registro e arquivo saem juntos, pela Edge excluir-anexo: o navegador
      // só apagava a linha e o arquivo ficava no bucket.
      const { error } = await invokeOrionFunction('excluir-anexo', { attachmentId });
      if (error) throw new Error(error.message);
      return { attachmentId, ticketId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-attachments', data.ticketId] });
      toast({
        title: 'Arquivo removido',
        description: 'O anexo foi removido com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover o arquivo.',
        variant: 'destructive',
      });
    }
  });
};
