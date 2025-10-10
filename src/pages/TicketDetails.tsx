import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock, User, Tag, AlertCircle, PlayCircle, PauseCircle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TicketUpdate {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  type: 'comment' | 'status' | 'assignment';
}

const TicketDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'open' | 'in-progress' | 'paused' | 'closed'>('open');
  const [newUpdate, setNewUpdate] = useState('');
  const [updates, setUpdates] = useState<TicketUpdate[]>([
    {
      id: '1',
      author: 'Marcos Almeida',
      content: 'Ticket criado e aguardando análise.',
      timestamp: 'há 21m',
      type: 'status'
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
    'paused': 'Pausado',
    'closed': 'Fechado'
  };

  const handleAddUpdate = () => {
    if (!newUpdate.trim()) return;

    const update: TicketUpdate = {
      id: Date.now().toString(),
      author: 'Samuel',
      content: newUpdate,
      timestamp: 'agora',
      type: 'comment'
    };

    setUpdates([...updates, update]);
    setNewUpdate('');
    
    toast({
      title: "Atualização adicionada",
      description: "Sua atualização foi registrada no ticket.",
    });
  };

  const handleStatusChange = (newStatus: typeof status) => {
    setStatus(newStatus);
    
    const statusUpdate: TicketUpdate = {
      id: Date.now().toString(),
      author: 'Samuel',
      content: `Status alterado para: ${statusLabels[newStatus]}`,
      timestamp: 'agora',
      type: 'status'
    };

    setUpdates([...updates, statusUpdate]);
    
    toast({
      title: "Status atualizado",
      description: `Ticket marcado como ${statusLabels[newStatus]}`,
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
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-foreground">{ticket.id}</h1>
                    <Badge variant="outline">{statusLabels[status]}</Badge>
                  </div>
                  <h2 className="text-xl text-foreground mb-4">{ticket.title}</h2>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Solicitante</p>
                  <p className="font-medium text-foreground">{ticket.requester}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Categoria</p>
                  <p className="font-medium text-foreground">{ticket.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Prioridade</p>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", priorityColors[ticket.priority])}></div>
                    <span className="font-medium text-foreground">{priorityLabels[ticket.priority]}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Criado</p>
                  <p className="font-medium text-foreground">{ticket.created}</p>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">Descrição</h3>
                <p className="text-muted-foreground leading-relaxed">{ticket.description}</p>
              </div>

              <Separator className="my-6" />

              {/* Atualizações */}
              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-4">Atualizações</h3>
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{update.author}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{update.timestamp}</span>
                      </div>
                      <p className="text-muted-foreground">{update.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adicionar Atualização */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Adicionar Atualização</h3>
                <Textarea
                  placeholder="Digite sua atualização..."
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  className="mb-3"
                  rows={4}
                />
                <Button onClick={handleAddUpdate}>Adicionar Atualização</Button>
              </div>
            </Card>
          </div>

          {/* Ações do Ticket */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Ações</h3>
              <div className="space-y-3">
                <Button
                  variant="default"
                  className="w-full justify-start gap-2"
                  onClick={() => handleStatusChange('in-progress')}
                  disabled={status === 'in-progress' || status === 'closed'}
                >
                  <PlayCircle className="w-4 h-4" />
                  Iniciar Atendimento
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleStatusChange('paused')}
                  disabled={status !== 'in-progress'}
                >
                  <PauseCircle className="w-4 h-4" />
                  Pausar
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-success hover:text-success"
                  onClick={() => handleStatusChange('closed')}
                  disabled={status === 'closed'}
                >
                  <CheckCircle className="w-4 h-4" />
                  Fechar Ticket
                </Button>
                
                <Separator />
                
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar Ticket
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Informações</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Operador Responsável</p>
                  <p className="font-medium text-foreground">{ticket.operator}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Departamento</p>
                  <p className="font-medium text-foreground">{ticket.department}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">E-mail do Solicitante</p>
                  <p className="font-medium text-foreground text-sm break-all">{ticket.email}</p>
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
