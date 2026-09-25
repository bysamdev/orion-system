import React, { useState } from 'react';
import { Download, FileIcon, ImageIcon, FileText, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { TicketAttachment, useDeleteAttachment } from '@/hooks/useTicketAttachments';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AttachmentListProps {
  attachments: TicketAttachment[];
  ticketId: string;
  canDelete?: boolean;
  isLoading?: boolean;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  ticketId,
  canDelete = false,
  isLoading = false
}) => {
  const deleteAttachment = useDeleteAttachment();
  const [anexoParaExcluir, setAnexoParaExcluir] = useState<TicketAttachment | null>(null);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (type.includes('word')) return <FileText className="w-5 h-5 text-blue-600" />;
    if (type.includes('excel') || type.includes('spreadsheet')) return <FileText className="w-5 h-5 text-green-600" />;
    return <FileIcon className="w-5 h-5 text-muted-foreground" />;
  };

  const handleDownload = (attachment: TicketAttachment) => {
    window.open(attachment.file_url, '_blank');
  };

  const handleDelete = () => {
    if (!anexoParaExcluir) return;
    deleteAttachment.mutate(
      { attachmentId: anexoParaExcluir.id, ticketId },
      { onSuccess: () => setAnexoParaExcluir(null) }
    );
  };

  const isImage = (type: string) => type.startsWith('image/');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground text-sm">
        Nenhum anexo neste chamado
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div 
          key={attachment.id} 
          className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg group overflow-hidden"
        >
          {/* Preview de imagem ou ícone */}
          {isImage(attachment.file_type) && attachment.disponibilidade === 'disponivel' ? (
            <img 
              src={attachment.file_url} 
              alt={attachment.file_name}
              className="w-12 h-12 object-cover rounded border border-border cursor-pointer hover:opacity-80"
              onClick={() => handleDownload(attachment)}
            />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center bg-muted rounded border border-border">
              {getFileIcon(attachment.file_type)}
            </div>
          )}
          
          {/* Info do arquivo */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">
              {attachment.file_name}
            </p>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(attachment.created_at), { 
                locale: ptBR, 
                addSuffix: true 
              })}
            </p>
            {attachment.disponibilidade !== 'disponivel' && (
              <p className="text-xs text-destructive" role="status">
                {attachment.disponibilidade === 'ausente'
                  ? 'Arquivo não encontrado no armazenamento. Solicite um novo envio.'
                  : 'Arquivo indisponível no momento. Tente novamente mais tarde.'}
              </p>
            )}
          </div>
          
          {/* Ações */}
          <div className="flex items-center gap-1 opacity-50 hover:opacity-100 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDownload(attachment)}
              disabled={attachment.disponibilidade !== 'disponivel'}
              aria-label="Baixar arquivo"
              title="Baixar arquivo"
            >
              <Download className="w-4 h-4" />
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setAnexoParaExcluir(attachment)}
                disabled={deleteAttachment.isPending}
                aria-label="Excluir anexo"
                title="Excluir anexo"
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
      <AlertDialog
        open={anexoParaExcluir !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAttachment.isPending) setAnexoParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo “{anexoParaExcluir?.file_name}” será removido permanentemente deste chamado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAttachment.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAttachment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {deleteAttachment.isPending ? 'Excluindo...' : 'Excluir anexo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
