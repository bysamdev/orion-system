import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

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
              const { data: urlData, error: signError } = await supabase.storage
                .from('ticket-files')
                .createSignedUrl(storagePath, 60 * 60 * 24);

              if (!signError && urlData?.signedUrl) {
                return {
                  ...attachment,
                  file_url: urlData.signedUrl
                };
              }
            } catch (err) {
              console.error('Erro ao gerar signed URL para anexo:', attachment.id, err);
            }
          }

          return attachment as TicketAttachment;
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
      file 
    }: { 
      ticketId: string; 
      file: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
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
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-attachments', variables.ticketId] });
      toast({
        title: 'Arquivo enviado',
        description: 'O arquivo foi anexado com sucesso.',
      });
    },
    onError: (error: any) => {
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
      const { error } = await supabase
        .from('ticket_attachments')
        .delete()
        .eq('id', attachmentId);
      
      if (error) throw error;
      return { attachmentId, ticketId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-attachments', data.ticketId] });
      toast({
        title: 'Arquivo removido',
        description: 'O anexo foi removido com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover o arquivo.',
        variant: 'destructive',
      });
    }
  });
};
