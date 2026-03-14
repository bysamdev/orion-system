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
import { EscalateDialog } from '@/components/ticket/EscalateDialog';
import { ArrowLeft, Clock, MessageSquare, Info, Paperclip, Upload, Monitor, Copy, Check, Lock, AlertCircle, Timer, Settings, Loader2 } from 'lucide-react';
import { CannedResponseSelector } from '@/components/ticket/CannedResponseSelector';
import { AttachmentList } from '@/components/ticket/AttachmentList';
import { ImagePasteHandler } from '@/components/ticket/ImagePasteHandler';
import { TimeTracker } from '@/components/ticket/TimeTracker';
import { SatisfactionSurvey } from '@/components/ticket/SatisfactionSurvey';
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

// ── Ticket Status Stepper ─────────────────────────────────
const TicketStatusStepper = ({ currentStatus }: { currentStatus: string }) => {
  const steps = [
    { key: 'open', label: 'Aberto' },
    { key: 'in-progress', label: 'Em Atendimento' },
    { key: 'resolved', label: 'Resolvido' },
    { key: 'closed', label: 'Concluído' },
  ];

  const getStatusIndex = (status: string) => {
    if (status === 'reopened') return 1;
    if (status === 'awaiting-customer' || status === 'awaiting-third-party') return 1;
    if (status === 'cancelled') return -1;
    return steps.findIndex(s => s.key === status);
  };

  const currentIndex = getStatusIndex(currentStatus);

  return (
    <div className="w-full py-6 px-4 mb-6 bg-muted/20 border border-border/50 rounded-xl overflow-x-auto">
      <div className="flex items-center justify-between min-w-[500px]">
        {steps.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isPast = idx < currentIndex;
          const isLast = idx === steps.length - 1;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-2 relative z-10">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                  isActive ? "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]" :
                  isPast ? "bg-green-500 border-green-500 text-white" :
                  "bg-background border-muted-foreground/20 text-muted-foreground"
                )}>
                  {isPast ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-tight whitespace-nowrap",
                  isActive ? "text-primary" : isPast ? "text-green-600" : "text-muted-foreground opacity-60"
                )}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 h-[2px] mx-2 bg-muted-foreground/10 relative -translate-y-3.5">
                  <div className={cn(
                    "absolute top-0 left-0 h-full transition-all duration-1000",
                    isPast ? "w-full bg-green-500" : "w-0 bg-primary"
                  )} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

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
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
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

  const handleEscalateConfirm = async (technicianName: string, newPriority: string, reason: string) => {
    if (!ticket) return;
    
    // Atualizar atribuição e prioridade
    const { error: prioError } = await supabase.from('tickets').update({ priority: newPriority }).eq('id', ticket.id);
    if (!prioError && newPriority !== ticket.priority) {
       await addUpdate.mutateAsync({ ticket_id: ticket.id, content: `Prioridade escalada para: ${newPriority}`, type: 'priority_change' });
    }
    
    if (technicianName !== ticket.assigned_to) {
       await updateAssignment.mutateAsync({ id: ticket.id, assigned_to: technicianName === 'unassigned' ? null : technicianName });
       await addUpdate.mutateAsync({ ticket_id: ticket.id, content: `Chamado escalado para: ${technicianName === 'unassigned' ? 'Fila Geral' : technicianName}`, type: 'assignment' });
    }

    // Adicionar comentário de escalação como nota interna
    await addUpdate.mutateAsync({ 
      ticket_id: ticket.id, 
      content: `[ESCALAÇÃO] Motivo: ${reason}`, 
      type: 'comment', 
      is_internal: true 
    });

    setEscalateDialogOpen(false);
    toast({ title: 'Chamado Escalado', description: 'O chamado foi escalado com sucesso e todos foram notificados.' });
  };

  const handleResolveConfirm = async (notes: string, _sendSurvey: boolean) => {
    if (!ticket) return;
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

  const totalMinutes = timeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
  const billableMinutes = timeEntries.filter(te => te.billable).reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h${min > 0 ? `${min}min` : ''}` : `${min}min`;
  };

  if (ticketLoading || updatesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full text-center">
          <TopBar />
          <p className="text-muted-foreground mt-20 mb-4">Chamado não encontrado.</p>
          <Button onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4 mr-2" />Voltar ao Dashboard</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />

        <Button 
          variant="ghost" 
          onClick={() => navigate('/')} 
          className="mb-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Painel de Chamados
        </Button>

        {/* Status Stepper */}
        <TicketStatusStepper currentStatus={ticket.status} />

        {/* Hero Header */}
        <div className="mb-8">
          <TicketHeroHeader
            ticket={ticket}
            canManageTickets={canManageTickets}
            onResolve={() => setResolveDialogOpen(true)}
            onEscalate={() => setEscalateDialogOpen(true)}
            onAttach={() => fileInputRef.current?.click()}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Content (Left Column) */}
          <div className="xl:col-span-2 space-y-8">
            
            {(ticket.status === 'resolved' || ticket.status === 'closed') && !canManageTickets && (
              <SatisfactionSurvey ticketId={ticket.id} />
            )}

            {/* Problema / Descrição */}
            <Card className="p-8 border-none shadow-sm bg-muted/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Info className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className="font-bold text-lg">Descrição do Problema</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm md:text-base selection:bg-primary/20">
                {ticket.description}
              </p>
            </Card>

            {/* Histórico / Timeline */}
            <Card className="p-8 border-none shadow-sm overflow-hidden bg-background border border-border/40">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Histórico e Interações</h3>
              </div>
              <UnifiedTimeline
                updates={updates}
                statusHistory={statusHistory}
                timeEntries={timeEntries}
              />
            </Card>

            {/* Campo de Resposta / Nova Interação */}
            {!canReopenTicket ? (
              <Card className="p-8 border-none shadow-sm bg-muted/10 border-t-2 border-primary/20">
                <ImagePasteHandler
                  onImagePaste={(file) => { if (id) uploadAttachment.mutate({ ticketId: id, file }); }}
                  disabled={uploadAttachment.isPending}
                />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Nova Interação</h3>
                  <div className="flex items-center gap-2">
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-3 gap-2 border-border/50 hover:bg-background"
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={uploadAttachment.isPending}
                    >
                      {uploadAttachment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      Anexar
                    </Button>
                    {canManageTickets && <CannedResponseSelector onSelect={(content) => setNewUpdateText(content)} />}
                  </div>
                </div>
                
                <div className="relative group">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Escreva sua resposta ou nota aqui..."
                    value={newUpdateText}
                    onChange={(e) => setNewUpdateText(e.target.value)}
                    className="min-h-[160px] bg-background border-border/50 focus-visible:ring-primary/20 resize-none p-4 text-base transition-all group-hover:border-primary/20"
                    maxLength={5000}
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] font-medium text-muted-foreground/60">
                    {newUpdateText.length}/5000
                  </div>
                </div>

                <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {canManageTickets ? (
                    <div className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all w-full md:w-auto md:min-w-[280px]",
                      isInternalNote 
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400" 
                        : "bg-background border-border/50"
                    )}>
                      <div className="flex items-center gap-2.5">
                        <Lock className={cn("w-4 h-4", isInternalNote ? "text-amber-500" : "text-muted-foreground")} />
                        <Label htmlFor="internal-note" className="text-xs font-bold cursor-pointer uppercase tracking-tight">
                          Nota Interna (Privada)
                        </Label>
                      </div>
                      <Switch id="internal-note" checked={isInternalNote} onCheckedChange={setIsInternalNote} />
                    </div>
                  ) : <div />}

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleAddUpdate}
                      disabled={addUpdate.isPending || !newUpdateText.trim()}
                      className={cn(
                        "h-11 px-6 font-bold transition-all shadow-sm",
                        isInternalNote ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary hover:bg-primary/90"
                      )}
                    >
                      {isInternalNote ? "Publicar Nota Privada" : "Enviar Resposta"}
                    </Button>
                    {canManageTickets && newUpdateText.trim() && (
                      <Button
                        variant="secondary"
                        onClick={() => handleAddUpdate().then(() => setResolveDialogOpen(true))}
                        disabled={addUpdate.isPending}
                        className="h-11 px-6 border border-border/50"
                      >
                        Responder e Resolver
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-8 bg-muted/20 border-dashed flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Chamado Resolvido/Fechado</h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[400px]">
                    Novas interações estão bloqueadas. Reabra o chamado clicando no botão abaixo caso o problema ainda persista.
                  </p>
                </div>
                <Button variant="outline" className="h-11 px-8 font-bold border-primary text-primary hover:bg-primary/5" onClick={handleReopenTicket}>
                  Reabrir Chamado
                </Button>
              </Card>
            )}
          </div>

          {/* Sidebar (Right Column) */}
          <div className="space-y-8">
            
            {/* Gestão Sidebar */}
            <Card className="p-6 border-none shadow-sm bg-muted/30">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-foreground uppercase text-xs tracking-widest">Controles do Chamado</h3>
              </div>

              {!canManageTickets ? (
                <div className="bg-background/60 border border-border/50 rounded-xl p-4">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Apenas técnicos autorizados podem alterar o fluxo de trabalho deste ticket.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Progresso do Fluxo</label>
                    <Select value={ticket.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="h-11 bg-background border-border/50 font-medium">
                        <SelectValue />
                      </SelectTrigger>
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

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Agente Responsável</label>
                    <Select 
                      value={ticket.assigned_to || ''} 
                      onValueChange={handleAssignmentChange} 
                      disabled={techniciansLoading}
                    >
                      <SelectTrigger className="h-11 bg-background border-border/50 font-medium">
                        <SelectValue placeholder={techniciansLoading ? "..." : "Selecione..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map(tech => (
                          <SelectItem key={tech.id} value={tech.full_name || ''}>{tech.full_name || 'Sem nome'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Intensidade de Prioridade</label>
                    <Select
                      value={ticket.priority}
                      onValueChange={async (val) => {
                         const validated = ticketPrioritySchema.safeParse(val);
                         if (!validated.success) return;
                         const { error } = await supabase.from('tickets').update({ priority: validated.data }).eq('id', ticket.id);
                         if (error) return;
                         await addUpdate.mutateAsync({ ticket_id: ticket.id, content: `Prioridade alterada para: ${val}`, type: 'priority_change' });
                         toast({ title: 'Prioridade alterada' });
                      }}
                    >
                      <SelectTrigger className="h-11 bg-background border-border/50 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent" className="text-red-600 font-bold">Urgente</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="bg-border/30" />

                  {ticket.status === 'resolved' && (
                    <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 flex items-start gap-3">
                      <Clock className="w-4 h-4 text-green-600 mt-0.5" />
                      <p className="text-[10px] font-medium text-green-800 dark:text-green-300">
                        O ticket será encerrado automaticamente em 48h caso não haja resposta.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* SLA Info */}
            {ticket.sla_due_date && (
              <Card className="p-6 border-none shadow-sm bg-background border border-border/40">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-foreground text-xs uppercase tracking-widest">Acordo de SLA</h3>
                  <SLABadge slaStatus={ticket.sla_status as any} slaDueDate={ticket.sla_due_date} />
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground">Vencimento</span>
                     <span className="font-bold">{new Date(ticket.sla_due_date).toLocaleString('pt-BR')}</span>
                   </div>
                   {ticket.first_response_at && (
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-muted-foreground">Primeira Resposta</span>
                       <span className="text-green-600 font-medium">{formatTimeAgo(ticket.first_response_at)}</span>
                     </div>
                   )}
                </div>
              </Card>
            )}

            {/* Cronógrafo */}
            {canManageTickets && (
              <Card className="p-6 border-none shadow-sm bg-background border border-border/40">
                <div className="flex items-center gap-2 mb-4">
                  <Timer className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-foreground text-xs uppercase tracking-widest">Cronógrafo de Atendimento</h3>
                </div>
                <TimeTracker ticketId={ticket.id} />
              </Card>
            )}

            {/* Resumo de Tempo (Visual para todos) */}
            <Card className="p-6 border-none shadow-sm bg-background border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-foreground text-xs uppercase tracking-widest">Esforço Total</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Total</p>
                  <p className="text-lg font-bold">{totalMinutes > 0 ? formatMinutes(totalMinutes) : '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Faturável</p>
                  <p className="text-lg font-bold text-primary">{billableMinutes > 0 ? formatMinutes(billableMinutes) : '—'}</p>
                </div>
              </div>
            </Card>

            {/* Atributos Básicos */}
            <Card className="p-6 border-none shadow-sm bg-background border border-border/40">
               <h3 className="font-bold text-foreground text-xs uppercase tracking-widest mb-6">Atributos Básicos</h3>
               <div className="space-y-4">
                 <AttributeItem label="Solicitante" value={ticket.requester_name} />
                 <AttributeItem label="Categoria" value={ticket.category} />
                 <AttributeItem label="Setor/Depto" value={ticket.department || 'Dpto. Geral'} />
                 <AttributeItem label="Data de Abertura" value={formatTimeAgo(ticket.created_at)} />
                 <AttributeItem label="Número Interno" value={`#${ticket.ticket_number}`} isMono />
               </div>
            </Card>

            {/* Acesso Remoto */}
            {canManageTickets && (ticket.remote_id || ticket.remote_password) && (
              <Card className="p-6 border-none shadow-sm bg-indigo-500/5 border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
                  <Monitor className="w-4 h-4" />
                  <h3 className="font-bold text-xs uppercase tracking-widest">Acesso Remoto</h3>
                </div>
                <div className="space-y-3">
                  <RemoteField label="ID da Máquina" value={ticket.remote_id} onCopy={() => copyToClipboard(ticket.remote_id!, 'ID')} />
                  <RemoteField label="Senha de Sessão" value={ticket.remote_password} onCopy={() => copyToClipboard(ticket.remote_password!, 'PASS')} />
                </div>
              </Card>
            )}

            {/* Anexos */}
            <Card className="p-6 border-none shadow-sm bg-background border border-border/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground text-xs uppercase tracking-widest">Arquivos ({attachments.length})</h3>
                <Paperclip className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <AttachmentList attachments={attachments} ticketId={id || ''} canDelete={canManageTickets} isLoading={attachmentsLoading} />
            </Card>
          </div>
        </div>
      </main>

      <ResolutionDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        onConfirm={handleResolveConfirm}
        isPending={updateStatus.isPending}
      />

      <EscalateDialog
        open={escalateDialogOpen}
        onOpenChange={setEscalateDialogOpen}
        onConfirm={handleEscalateConfirm}
        isPending={updateAssignment.isPending || addUpdate.isPending}
        technicians={technicians}
        currentPriority={ticket.priority}
        currentAssignee={ticket.assigned_to}
      />
    </div>
  );
};

// ── Shared Support Components ──────────────────────────────
const AttributeItem = ({ label, value, isMono }: { label: string; value: string; isMono?: boolean }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
    <span className={cn("text-sm font-semibold text-foreground", isMono && "font-mono")}>{value}</span>
  </div>
);

const RemoteField = ({ label, value, onCopy }: { label: string; value?: string; onCopy: () => void }) => {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-background/50 border border-border/30 rounded-lg p-2.5 transition-all hover:border-indigo-500/30">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none mb-1">{label}</p>
        <p className="font-mono text-xs font-bold truncate">{value}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600" onClick={onCopy}>
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

export default TicketDetails;
