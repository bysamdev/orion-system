import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Clock, User, Tag, AlertCircle, MessageSquare, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTicket, useTicketUpdates, useUpdateTicketStatus, useUpdateTicketAssignment, useAddTicketUpdate } from '@/hooks/useTickets';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';

const ticketUpdateSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'O comentário não pode estar vazio')
    .max(5000, 'O comentário não pode ter mais de 5000 caracteres')
});

const TicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: ticket, isLoading: ticketLoading } = useTicket(id || '');
  const { data: updates = [], isLoading: updatesLoading } = useTicketUpdates(id || '');
  const { data: userRole } = useUserRole();
  const updateStatus = useUpdateTicketStatus();
  const updateAssignment = useUpdateTicketAssignment();
  const addUpdate = useAddTicketUpdate();
  
  const [newUpdateText, setNewUpdateText] = useState('');

  // Fetch real technicians with their roles
  const { data: technicians = [], isLoading: techniciansLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      // First get user IDs with technician/admin roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['technician', 'admin']);
      
      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) return [];
      
      // Then fetch profiles for those users
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      
      if (profileError) throw profileError;
      return profiles || [];
    }
  });

  const priorityColors = {
    high: 'bg-destructive',
    medium: 'bg-warning',
    low: 'bg-muted'
  };

  const priorityLabels = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa'
  };

  const statusLabels = {
    'open': 'Aberto',
    'in-progress': 'Em Andamento',
    'resolved': 'Resolvido',
    'closed': 'Fechado'
  };

  const statusColors = {
    'open': 'bg-blue-500',
    'in-progress': 'bg-yellow-500',
    'resolved': 'bg-green-500',
    'closed': 'bg-gray-500'
  };

  // Check if user can manage tickets (technician or admin)
  const canManageTickets = userRole === 'technician' || userRole === 'admin';

  const handleAddUpdate = async () => {
    if (!ticket) return;

    // Validate input
    const validationResult = ticketUpdateSchema.safeParse({ content: newUpdateText });
    
    if (!validationResult.success) {
      toast({
        title: "Erro de validação",
        description: validationResult.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    // Author is now set automatically by database trigger
    await addUpdate.mutateAsync({
      ticket_id: ticket.id,
      content: validationResult.data.content,
      type: 'comment'
    });

    setNewUpdateText('');
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || !canManageTickets) return;
    
    await updateStatus.mutateAsync({ id: ticket.id, status: newStatus });
    
    // Add status change to updates (author set by trigger)
    await addUpdate.mutateAsync({
      ticket_id: ticket.id,
      content: `Status alterado para: ${statusLabels[newStatus as keyof typeof statusLabels]}`,
      type: 'status'
    });
  };

  const handleAssignmentChange = async (technicianName: string) => {
    if (!ticket || !canManageTickets) return;
    
    // Assignment now validated by database trigger
    await updateAssignment.mutateAsync({ id: ticket.id, assigned_to: technicianName });
    
    // Add assignment change to updates (author set by trigger)
    await addUpdate.mutateAsync({
      ticket_id: ticket.id,
      content: `Chamado atribuído para: ${technicianName}`,
      type: 'assignment'
    });
  };

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
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
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Detalhes do Ticket */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cabeçalho do Chamado */}
            <Card className="p-6">
              <div className="flex flex-col md:flex-row items-start justify-between mb-6 gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">#{ticket.ticket_number}</h1>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", statusColors[ticket.status])}></div>
                      <Badge variant="outline">{statusLabels[ticket.status]}</Badge>
                    </div>
                  </div>
                  <h2 className="text-lg md:text-xl text-foreground">{ticket.title}</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Solicitante
                  </p>
                  <p className="font-medium text-foreground">{ticket.requester_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Categoria
                  </p>
                  <p className="font-medium text-foreground">{ticket.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Prioridade
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", priorityColors[ticket.priority])}></div>
                    <span className="font-medium text-foreground">{priorityLabels[ticket.priority]}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Criado
                  </p>
                  <p className="font-medium text-foreground">{formatTimeAgo(ticket.created_at)}</p>
                </div>
              </div>
            </Card>

            {/* Descrição */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Descrição do Problema
              </h3>
              <p className="text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-4">
                {ticket.description}
              </p>
            </Card>

            {/* Timeline de Atualizações */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Histórico e Comentários
              </h3>
              <div className="space-y-4">
                {updates.map((update, index) => {
                  const updateDate = new Date(update.created_at);
                  return (
                    <div key={update.id} className="flex gap-3 md:gap-4">
                      {/* Timeline vertical */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={cn(
                          "w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center",
                          update.type === 'created' ? 'bg-blue-500/20' :
                          update.type === 'status' ? 'bg-yellow-500/20' :
                          update.type === 'assignment' ? 'bg-purple-500/20' :
                          'bg-green-500/20'
                        )}>
                          {update.type === 'created' ? <AlertCircle className="w-3 h-3 md:w-4 md:h-4 text-blue-500" /> :
                           update.type === 'status' ? <Clock className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" /> :
                           update.type === 'assignment' ? <User className="w-3 h-3 md:w-4 md:h-4 text-purple-500" /> :
                           <MessageSquare className="w-3 h-3 md:w-4 md:h-4 text-green-500" />}
                        </div>
                        {index < updates.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-2" />
                        )}
                      </div>
                      
                      {/* Conteúdo */}
                      <div className="flex-1 pb-6 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                          <span className="font-medium text-foreground text-sm truncate">{update.author}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(update.created_at)}
                          </span>
                        </div>
                        <p className={cn(
                          "text-sm leading-relaxed break-words",
                          update.type === 'comment' ? 'text-foreground bg-muted/30 rounded-lg p-3' : 'text-muted-foreground italic'
                        )}>
                          {update.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Campo de Resposta */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-3">Adicionar Comentário</h3>
              <Textarea
                placeholder="Digite sua resposta ou solução para o problema..."
                value={newUpdateText}
                onChange={(e) => setNewUpdateText(e.target.value)}
                className="mb-2"
                rows={4}
                maxLength={5000}
              />
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-muted-foreground">
                  {newUpdateText.length}/5000 caracteres
                </p>
                {newUpdateText.length > 4500 && (
                  <p className="text-xs text-warning">
                    {5000 - newUpdateText.length} caracteres restantes
                  </p>
                )}
              </div>
              <Button 
                onClick={handleAddUpdate} 
                className="w-full"
                disabled={addUpdate.isPending || !newUpdateText.trim()}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Enviar Comentário
              </Button>
            </Card>
          </div>

          {/* Painel de Gestão */}
          <div className="space-y-6">
            {/* Status e Atribuição */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Gestão do Chamado</h3>
              
              {!canManageTickets && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-muted-foreground">
                    Apenas técnicos e administradores podem gerenciar chamados.
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Status do Chamado
                  </label>
                  <Select 
                    value={ticket.status} 
                    onValueChange={handleStatusChange}
                    disabled={!canManageTickets}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="in-progress">Em Andamento</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Atribuir Técnico
                  </label>
                  <Select 
                    value={ticket.assigned_to || ''} 
                    onValueChange={handleAssignmentChange}
                    disabled={!canManageTickets || techniciansLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={techniciansLoading ? "Carregando..." : "Selecione um técnico"} />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.full_name || ''}>
                          {tech.full_name || 'Sem nome'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Button
                    variant="default"
                    className="w-full justify-start gap-2"
                    onClick={() => handleStatusChange('resolved')}
                    disabled={!canManageTickets || ticket.status === 'resolved' || ticket.status === 'closed' || updateStatus.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar como Resolvido
                  </Button>
                  
                  {ticket.status === 'resolved' && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Este chamado será fechado automaticamente em 48 horas se não houver resposta do solicitante.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Informações do Chamado */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Informações</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Técnico Responsável</p>
                  <p className="font-medium text-foreground">
                    {ticket.assigned_to || ticket.operator_name || 'Não atribuído'}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Departamento</p>
                  <p className="font-medium text-foreground">{ticket.department || 'N/A'}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">ID do Chamado</p>
                  <p className="font-medium text-foreground font-mono text-sm">#{ticket.ticket_number}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TicketDetails;
