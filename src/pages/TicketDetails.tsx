import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SLABadge } from '@/components/dashboard/SLABadge';
import { TicketHeroHeader } from '@/components/ticket/TicketHeroHeader';
import { UnifiedTimeline } from '@/components/ticket/UnifiedTimeline';
import { ResolutionDialog } from '@/components/ticket/ResolutionDialog';
import { ArrowLeft, Clock, MessageSquare, Info, Paperclip, Upload, Monitor, Copy, Check, Lock, AlertCircle, Timer } from 'lucide-react';
import { CannedResponseSelector } from '@/components/ticket/CannedResponseSelector';
import { AttachmentList } from '@/components/ticket/AttachmentList';
import { ImagePasteHandler } from '@/components/ticket/ImagePasteHandler';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTicket, useTicketUpdates, useUpdateTicketStatus, useUpdateTicketAssignment, useAddTicketUpdate } from '@/hooks/useTickets';
import { useUserRole } from '@/hooks/useUserRole';
import { useTicketAttachments, useUploadAttachment } from '@/hooks/useTicketAttachments';
import { useTicketTimeEntries } from '@/hooks/useTimeEntries';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { ticketPrioritySchema } from '@/lib/validation';
import { useRealtimeTicket } from '@/hooks/useRealtimeTickets';

const ticketUpdateSchema = z.object({
  content: z.string().trim().min(1, 'O comentário não pode estar vazio').max(5000, 'O comentário não pode ter mais de 5000 caracteres')
});

const TicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ticket, isLoading: ticketLoading } = useTicket(id || '');
  const { data: updates = [], isLoading: updatesLoading } = useTicketUpdates(id || '');
  const { data: userRole } = useUserRole();
  const updateStatus = useUpdateTicketStatus();
  const updateAssignment = useUpdateTicketAssignment();
  const addUpdate = useAddTicketUpdate();
  const { data: timeEntries = [] } = useTicketTimeEntries(id || '');

  // Buscar status history
  const { data: statusHistory = [] } = useQuery({
    queryKey: ['ticket-status-history', id],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from('ticket_status_history')
        .select('*')
        .eq('ticket_id', id!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const [newUpdateText, setNewUpdateText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({ title: 'Copiado!', description: 'Texto copiado para a área de transferência.' });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar o texto.', variant: 'destructive' });
    }
  };

  const { data: attachments = [], isLoading: attachmentsLoading } = useTicketAttachments(id || '');
  const uploadAttachment = useUploadAttachment();
  useRealtimeTicket(id || '');

  const { data: technicians = [], isLoading: techniciansLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase.from('user_roles').select('user_id').in('role', ['technician', 'admin']);
      if (roleError) throw roleError;
      if (!roleData?.length) return [];
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles, error } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      if (error) throw error;
      return profiles || [];
    }
  });

  const canManageTickets = userRole === 'technician' || userRole === 'admin' || userRole === 'developer';
  const canReopenTicket = ticket?.status === 'closed' || ticket?.status === 'resolved';

  const statusLabels: Record<string, string> = {
    'open': 'Aberto', 'in-progress': 'Em Andamento', 'awaiting-customer': 'Aguardando Cliente',
    'awaiting-third-party': 'Aguardando Terceiro', 'resolved': 'Resolvido', 'closed': 'Fechado',
    'reopened': 'Reaberto', 'cancelled': 'Cancelado'
  };

  const handleAddUpdate = async () => {
    if (!ticket) return;
    const result = ticketUpdateSchema.safeParse({ content: newUpdateText });
    if (!result.success) {
      toast({ title: "Erro de validação", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    await addUpdate.mutateAsync({ ticket_id: ticket.id, content: result.data.content, type: 'comment', is_internal: isInternalNote });
    setNewUpdateText('');
    setIsInternalNote(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || !canManageTickets) return;
    await updateStatus.mutateAsync({ id: ticket.id, status: newStatus });
    await addUpdate.mutateAsync({ ticket_id: ticket.id, content: `Status alterado para: ${statusLabels[newStatus] || newStatus}`, type: 'status_change' });
  };

  const handleAssignmentChange = async (technicianName: string) => {
    if (!ticket || !canManageTickets) return;
    await updateAssignment.mutateAsync({ id: ticket.id, assigned_to: technicianName });
    await addUpdate.mutateAsync({ ticket_id: ticket.id, content: `Chamado atribuído para: ${technicianName}`, type: 'assignment' });
  };

  const handleResolveConfirm = async (notes: string, _sendSurvey: boolean) => {
    if (!ticket) return;
    // Salvar resolution_notes
    await supabase.from('tickets').update({ resolution_notes: notes }).eq('id', ticket.id);
    await handleStatusChange('resolved');
    await addUpdate.mutateAsync({ ticket_id: ticket.id, content: `Resolução: ${notes}`, type: 'comment' });
    setResolveDialogOpen(false);
  };

  const handleReopenTicket = async () => {
    if (!ticket) return;
    try {
      await updateStatus.mutateAsync({ id: ticket.id, status: 'reopened' });
      await addUpdate.mutateAsync({ ticket_id: ticket.id, content: 'Chamado reaberto pelo usuário', type: 'status_change' });
      toast({ title: 'Chamado reaberto', description: 'O chamado foi reaberto com sucesso.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível reabrir o chamado.', variant: 'destructive' });
    }
  };

  const formatTimeAgo = (date: string) => formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });

  // Totais de horas
  const totalMinutes = timeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
  const billableMinutes = timeEntries.filter(te => te.billable).reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h${min > 0 ? `${min}min` : ''}` : `${min}min`;
  };

  if (ticketLoading || updatesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
          <TopBar />
          <p className="text-muted-foreground mt-8">Carregando chamado...</p>
        </main>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
          <TopBar />
          <div className="mt-8">
            <p className="text-muted-foreground mb-4">Chamado não encontrado.</p>
            <Button onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4 mr-2" />Voltar ao Dashboard</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />

        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar ao Dashboard
        </Button>

        {/* Hero Header */}
        <div className="mb-6">
          <TicketHeroHeader
            ticket={ticket}
            canManageTickets={canManageTickets}
            onResolve={() => setResolveDialogOpen(true)}
            onEscalate={() => {
              // Focar no select de técnico na sidebar
              const el = document.getElementById('technician-select');
              el?.click();
            }}
            onAttach={() => fileInputRef.current?.click()}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Descrição */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />Descrição do Problema
              </h3>
              <p className="text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-4 break-words whitespace-pre-wrap">
                {ticket.description}
              </p>
            </Card>

            {/* Timeline Unificada */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />Histórico e Interações
              </h3>
              <UnifiedTimeline
                updates={updates}
                statusHistory={statusHistory}
                timeEntries={timeEntries}
              />
            </Card>

            {/* Campo de Resposta */}
            {!canReopenTicket && (
              <Card className="p-6">
                <ImagePasteHandler
                  onImagePaste={(file) => { if (id) uploadAttachment.mutate({ ticketId: id, file }); }}
                  disabled={uploadAttachment.isPending}
                />
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Adicionar Comentário</h3>
                  <div className="flex items-center gap-2">
                    {/* Upload de arquivo oculto */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && id) uploadAttachment.mutate({ ticketId: id, file });
                        e.target.value = '';
                      }}
                      disabled={uploadAttachment.isPending}
                    />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadAttachment.isPending}>
                      {uploadAttachment.isPending ? <Upload className="w-4 h-4 animate-pulse" /> : <Paperclip className="w-4 h-4" />}
                    </Button>
                    {canManageTickets && <CannedResponseSelector onSelect={(content) => setNewUpdateText(content)} />}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">💡 Dica: Cole imagens diretamente (Ctrl+V) para anexar</p>
                <Textarea
                  ref={textareaRef}
                  placeholder="Digite sua resposta ou solução para o problema..."
                  value={newUpdateText}
                  onChange={(e) => setNewUpdateText(e.target.value)}
                  className="mb-2"
                  rows={4}
                  maxLength={5000}
                />
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs text-muted-foreground">{newUpdateText.length}/5000 caracteres</p>
                  {newUpdateText.length > 4500 && <p className="text-xs text-warning">{5000 - newUpdateText.length} caracteres restantes</p>}
                </div>

                {canManageTickets && (
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg mb-3 transition-colors",
                    isInternalNote ? "bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-muted/30"
                  )}>
                    <div className="flex items-center gap-2">
                      <Lock className={cn("w-4 h-4", isInternalNote ? "text-amber-600" : "text-muted-foreground")} />
                      <Label htmlFor="internal-note" className={cn("text-sm font-medium cursor-pointer", isInternalNote ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground")}>
                        Nota Interna (Apenas Equipe)
                      </Label>
                    </div>
                    <Switch id="internal-note" checked={isInternalNote} onCheckedChange={setIsInternalNote} />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddUpdate}
                    className={cn("flex-1", isInternalNote && "bg-amber-600 hover:bg-amber-700")}
                    disabled={addUpdate.isPending || !newUpdateText.trim()}
                  >
                    {isInternalNote ? <><Lock className="w-4 h-4 mr-2" />Enviar Nota Interna</> : <><MessageSquare className="w-4 h-4 mr-2" />Enviar Comentário</>}
                  </Button>
                  {canManageTickets && newUpdateText.trim() && (
                    <Button
                      variant="default"
                      onClick={() => {
                        // Enviar comentário + abrir dialog de resolução
                        handleAddUpdate().then(() => setResolveDialogOpen(true));
                      }}
                      disabled={addUpdate.isPending}
                      className="gap-2"
                    >
                      Responder e Resolver
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {canReopenTicket && (
              <Card className="p-6 bg-muted/30">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Este chamado está {ticket.status === 'closed' ? 'fechado' : 'resolvido'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Para adicionar novos comentários, reabra o chamado usando o botão "Reabrir Chamado".
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Gestão */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Gestão do Chamado</h3>
              {!canManageTickets && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-muted-foreground">Apenas técnicos e administradores podem gerenciar chamados.</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Status</label>
                  <Select value={ticket.status} onValueChange={handleStatusChange} disabled={!canManageTickets}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="in-progress">Em Andamento</SelectItem>
                      <SelectItem value="awaiting-customer">Aguardando Cliente</SelectItem>
                      <SelectItem value="awaiting-third-party">Aguardando Terceiro</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                      <SelectItem value="reopened">Reaberto</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Técnico Responsável</label>
                  <Select value={ticket.assigned_to || ''} onValueChange={handleAssignmentChange} disabled={!canManageTickets || techniciansLoading}>
                    <SelectTrigger><SelectValue placeholder={techniciansLoading ? "Carregando..." : "Selecione um técnico"} /></SelectTrigger>
                    <SelectContent>
                      {technicians.map(tech => (
                        <SelectItem key={tech.id} value={tech.full_name || ''}>{tech.full_name || 'Sem nome'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Prioridade</label>
                  <Select
                    value={ticket.priority}
                    onValueChange={async (newPriority) => {
                      if (!canManageTickets) return;
                      
                      // Validar prioridade com Zod antes de enviar
                      const validated = ticketPrioritySchema.safeParse(newPriority);
                      if (!validated.success) {
                        toast({ 
                          title: 'Erro de validação', 
                          description: validated.error.errors[0].message, 
                          variant: 'destructive' 
                        });
                        return;
                      }
                      
                      const { error } = await supabase.from('tickets').update({ priority: validated.data }).eq('id', ticket.id);
                      if (error) {
                        toast({ 
                          title: 'Erro', 
                          description: 'Não foi possível alterar a prioridade.', 
                          variant: 'destructive' 
                        });
                        return;
                      }
                      
                      await addUpdate.mutateAsync({ 
                        ticket_id: ticket.id, 
                        content: `Prioridade alterada para: ${newPriority}`, 
                        type: 'priority_change' 
                      });
                      
                      toast({ title: 'Prioridade atualizada', description: `A prioridade foi alterada para ${newPriority}.` });
                    }}
                    disabled={!canManageTickets}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgente</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {canReopenTicket && (
                  <Button variant="secondary" className="w-full gap-2" onClick={handleReopenTicket} disabled={updateStatus.isPending}>
                    <AlertCircle className="w-4 h-4" />Reabrir Chamado
                  </Button>
                )}

                {ticket.status === 'resolved' && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />Fechamento automático em 48h sem resposta.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* SLA */}
            {ticket.sla_due_date && (
              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-3">SLA</h3>
                <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} />
                <p className="text-xs text-muted-foreground mt-2">
                  Prazo: {new Date(ticket.sla_due_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
                {ticket.first_response_at && (
                  <p className="text-xs text-muted-foreground mt-1">1ª resposta: {formatTimeAgo(ticket.first_response_at)}</p>
                )}
              </Card>
            )}

            {/* Tempo Registrado */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Timer className="w-4 h-4" />Tempo Registrado
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium text-foreground">{totalMinutes > 0 ? formatMinutes(totalMinutes) : '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Faturável</span>
                  <span className="font-medium text-foreground">{billableMinutes > 0 ? formatMinutes(billableMinutes) : '—'}</span>
                </div>
                <p className="text-xs text-muted-foreground">{timeEntries.length} registros</p>
              </div>
            </Card>

            {/* Informações */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Informações</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Solicitante</p>
                  <p className="text-sm font-medium text-foreground">{ticket.requester_name}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <p className="text-sm font-medium text-foreground">{ticket.category}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Departamento</p>
                  <p className="text-sm font-medium text-foreground">{ticket.department || 'N/A'}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Criado</p>
                  <p className="text-sm font-medium text-foreground">{formatTimeAgo(ticket.created_at)}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="text-sm font-mono font-medium text-foreground">#{ticket.ticket_number}</p>
                </div>
              </div>
            </Card>

            {/* Acesso Remoto */}
            {canManageTickets && (ticket.remote_id || ticket.remote_password) && (
              <Card className="p-6 border-primary/20 bg-primary/5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />Acesso Remoto
                </h3>
                <div className="space-y-3">
                  {ticket.remote_id && (
                    <div className="flex items-center justify-between gap-2 bg-background rounded-lg p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">ID</p>
                        <p className="font-mono text-sm font-medium text-foreground truncate">{ticket.remote_id}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => copyToClipboard(ticket.remote_id!, 'remote_id')}>
                        {copiedField === 'remote_id' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                  {ticket.remote_password && (
                    <div className="flex items-center justify-between gap-2 bg-background rounded-lg p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Senha</p>
                        <p className="font-mono text-sm font-medium text-foreground truncate">{ticket.remote_password}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => copyToClipboard(ticket.remote_password!, 'remote_password')}>
                        {copiedField === 'remote_password' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">⚠️ Credenciais temporárias para esta sessão.</p>
              </Card>
            )}

            {/* Anexos */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />Anexos ({attachments.length})
              </h3>
              <AttachmentList attachments={attachments} ticketId={id || ''} canDelete={canManageTickets} isLoading={attachmentsLoading} />
            </Card>
          </div>
        </div>
      </main>

      {/* Resolution Dialog */}
      <ResolutionDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        onConfirm={handleResolveConfirm}
        isPending={updateStatus.isPending}
      />
    </div>
  );
};

export default TicketDetails;
