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
      return data as TicketAttachment[];
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
      
      // Gerar URL pública (signed URL para bucket privado)
      const { data: urlData } = await supabase.storage
        .from('ticket-files')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 ano
      
      if (!urlData?.signedUrl) throw new Error('Erro ao gerar URL do arquivo');
      
      // Salvar referência no banco
      const { data, error } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          file_name: file.name,
          file_url: urlData.signedUrl,
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
