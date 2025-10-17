import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

interface TicketUpdate {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  date: string;
  type: 'comment' | 'status' | 'assignment' | 'created';
}

const TicketDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'open' | 'in-progress' | 'resolved' | 'closed'>('open');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [newUpdate, setNewUpdate] = useState('');
  const [updates, setUpdates] = useState<TicketUpdate[]>([
    {
      id: '1',
      author: 'Sistema',
      content: 'Chamado criado por Cleber Junior',
      timestamp: '10:30',
      date: '18 Jan 2025',
      type: 'created'
    }
  ]);

  // Mock data - em produção viria de uma API
  const ticket = {
    id: id || '#1010',
    title: 'Problema no acesso ao ERP',
    requester: 'Cleber Junior',
    email: 'cleber.junior@exemplo.com',
    department: 'Financeiro',
    category: 'ERP',
    priority: 'high' as const,
    operator: 'Marcos Almeida',
    created: 'há 21m',
    description: 'Não consigo acessar o sistema ERP. Quando tento fazer login, aparece uma mensagem de erro "Conexão recusada". Já tentei limpar o cache do navegador e reiniciar o computador, mas o problema persiste.',
  };

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

  const availableTechnicians = [
    'Samuel Costa',
    'Marcos Almeida',
    'Ana Silva',
    'Pedro Santos'
  ];

  const handleAddUpdate = () => {
    if (!newUpdate.trim()) return;

    const now = new Date();
    const update: TicketUpdate = {
      id: Date.now().toString(),
      author: assignedTo || 'Samuel Costa',
      content: newUpdate,
      timestamp: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
      type: 'comment'
    };

    setUpdates([...updates, update]);
    setNewUpdate('');
    
    toast({
      title: "Comentário adicionado",
      description: "Sua resposta foi registrada no chamado.",
    });
  };

  const handleStatusChange = (newStatus: typeof status) => {
    const now = new Date();
    setStatus(newStatus);
    
    const statusUpdate: TicketUpdate = {
      id: Date.now().toString(),
      author: 'Sistema',
      content: `Status alterado para: ${statusLabels[newStatus]}`,
      timestamp: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
      type: 'status'
    };

    setUpdates([...updates, statusUpdate]);
    
    toast({
      title: "Status atualizado",
      description: `Chamado marcado como ${statusLabels[newStatus]}`,
    });
  };

  const handleAssignmentChange = (technician: string) => {
    const now = new Date();
    setAssignedTo(technician);
    
    const assignmentUpdate: TicketUpdate = {
      id: Date.now().toString(),
      author: 'Sistema',
      content: `Chamado atribuído para: ${technician}`,
      timestamp: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
      type: 'assignment'
    };

    setUpdates([...updates, assignmentUpdate]);
    
    toast({
      title: "Técnico atribuído",
      description: `Chamado atribuído para ${technician}`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
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
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-foreground">{ticket.id}</h1>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", statusColors[status])}></div>
                      <Badge variant="outline">{statusLabels[status]}</Badge>
                    </div>
                  </div>
                  <h2 className="text-xl text-foreground">{ticket.title}</h2>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Solicitante
                  </p>
                  <p className="font-medium text-foreground">{ticket.requester}</p>
                  <p className="text-xs text-muted-foreground">{ticket.email}</p>
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
                  <p className="font-medium text-foreground">{ticket.created}</p>
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
                {updates.map((update, index) => (
                  <div key={update.id} className="flex gap-4">
                    {/* Timeline vertical */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        update.type === 'created' ? 'bg-blue-500/20' :
                        update.type === 'status' ? 'bg-yellow-500/20' :
                        update.type === 'assignment' ? 'bg-purple-500/20' :
                        'bg-green-500/20'
                      )}>
                        {update.type === 'created' ? <AlertCircle className="w-4 h-4 text-blue-500" /> :
                         update.type === 'status' ? <Clock className="w-4 h-4 text-yellow-500" /> :
                         update.type === 'assignment' ? <User className="w-4 h-4 text-purple-500" /> :
                         <MessageSquare className="w-4 h-4 text-green-500" />}
                      </div>
                      {index < updates.length - 1 && (
                        <div className="w-0.5 h-full bg-border mt-2" />
                      )}
                    </div>
                    
                    {/* Conteúdo */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground text-sm">{update.author}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{update.date}</span>
                          <span>•</span>
                          <span>{update.timestamp}</span>
                        </div>
                      </div>
                      <p className={cn(
                        "text-sm leading-relaxed",
                        update.type === 'comment' ? 'text-foreground bg-muted/30 rounded-lg p-3' : 'text-muted-foreground italic'
                      )}>
                        {update.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Campo de Resposta */}
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-3">Adicionar Comentário</h3>
              <Textarea
                placeholder="Digite sua resposta ou solução para o problema..."
                value={newUpdate}
                onChange={(e) => setNewUpdate(e.target.value)}
                className="mb-3"
                rows={4}
              />
              <Button onClick={handleAddUpdate} className="w-full">
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
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Status do Chamado
                  </label>
                  <Select value={status} onValueChange={(value) => handleStatusChange(value as typeof status)}>
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
                  <Select value={assignedTo} onValueChange={handleAssignmentChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTechnicians.map((tech) => (
                        <SelectItem key={tech} value={tech}>{tech}</SelectItem>
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
                    disabled={status === 'resolved' || status === 'closed'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar como Resolvido
                  </Button>
                  
                  {status === 'resolved' && (
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
                    {assignedTo || ticket.operator}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Departamento</p>
                  <p className="font-medium text-foreground">{ticket.department}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">ID do Chamado</p>
                  <p className="font-medium text-foreground font-mono text-sm">{ticket.id}</p>
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
