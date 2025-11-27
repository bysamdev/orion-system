import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Zap, Clock, FileText, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SLATestResult {
  id: string;
  ticket_number: number;
  priority: string;
  created_at: string;
  sla_due_date: string;
  expected_hours: number;
  calculated_hours: number;
  status: 'success' | 'error';
}

interface RateLimitResult {
  attempt: number;
  allowed: boolean;
  message?: string;
  timestamp: string;
  httpStatus?: number;
  errorDetails?: string;
}

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  changed_by: string;
  changed_at: string;
}

const DebugTools = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile } = useUserProfile();
  
  // SLA Test State
  const [slaResults, setSlaResults] = useState<SLATestResult[]>([]);
  const [isSlaRunning, setIsSlaRunning] = useState(false);
  
  // Rate Limit Test State
  const [rateLimitResults, setRateLimitResults] = useState<RateLimitResult[]>([]);
  const [isRateLimitRunning, setIsRateLimitRunning] = useState(false);
  
  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  
  // Test tickets to cleanup
  const [testTicketIds, setTestTicketIds] = useState<string[]>([]);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Check access - only developer or admin
  const hasAccess = role === 'developer' || role === 'admin';

  // Load audit logs on mount and setup realtime
  useEffect(() => {
    if (hasAccess) {
      fetchAuditLogs();
      
      // Setup realtime subscription for audit_log
      const channel = supabase
        .channel('audit-log-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'audit_log'
          },
          (payload) => {
            console.log('New audit log:', payload);
            setAuditLogs(prev => [payload.new as AuditLogEntry, ...prev.slice(0, 4)]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [hasAccess]);

  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // SLA Test - Create tickets with different priorities
  const runSlaTest = async () => {
    if (!user || !profile) return;
    
    setIsSlaRunning(true);
    setSlaResults([]);
    const newTestIds: string[] = [];
    
    const priorities = [
      { name: 'low', expectedHours: 72 },
      { name: 'medium', expectedHours: 48 },
      { name: 'high', expectedHours: 24 },
      { name: 'urgent', expectedHours: 4 },
    ];

    try {
      for (const priority of priorities) {
        const { data: ticket, error } = await supabase
          .from('tickets')
          .insert({
            title: `[DEBUG-SLA-TEST] Ticket de teste - Prioridade ${priority.name}`,
            description: 'Ticket criado automaticamente para testar cálculo de SLA',
            category: 'outros',
            priority: priority.name,
            requester_name: profile.full_name,
            user_id: user.id,
            company_id: profile.company_id,
          })
          .select()
          .single();

        if (error) {
          console.error(`Error creating ${priority.name} ticket:`, error);
          continue;
        }

        newTestIds.push(ticket.id);

        // Calculate hours difference
        const createdAt = new Date(ticket.created_at);
        const slaDueDate = new Date(ticket.sla_due_date);
        const calculatedHours = Math.round((slaDueDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

        setSlaResults(prev => [...prev, {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          priority: priority.name,
          created_at: ticket.created_at,
          sla_due_date: ticket.sla_due_date,
          expected_hours: priority.expectedHours,
          calculated_hours: calculatedHours,
          status: calculatedHours === priority.expectedHours ? 'success' : 'error'
        }]);
      }

      setTestTicketIds(prev => [...prev, ...newTestIds]);
      
      toast({
        title: 'Teste de SLA concluído',
        description: `${priorities.length} tickets criados para validação`,
      });
    } catch (error) {
      console.error('SLA test error:', error);
      toast({
        title: 'Erro no teste',
        description: 'Ocorreu um erro ao executar o teste de SLA',
        variant: 'destructive',
      });
    } finally {
      setIsSlaRunning(false);
    }
  };

  // Rate Limit Test - Try to create 15 tickets rapidly
  const runRateLimitTest = async () => {
    if (!user) return;
    
    setIsRateLimitRunning(true);
    setRateLimitResults([]);
    
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      toast({
        title: 'Erro',
        description: 'Não foi possível obter token de autenticação',
        variant: 'destructive',
      });
      setIsRateLimitRunning(false);
      return;
    }

    console.log('Starting rate limit test with token:', accessToken.slice(0, 20) + '...');

    try {
      for (let i = 1; i <= 15; i++) {
        try {
          const response = await supabase.functions.invoke('check-rate-limit', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          console.log(`Attempt ${i}:`, response);

          // Extract detailed error info
          let httpStatus: number | undefined;
          let errorDetails: string | undefined;
          
          if (response.error) {
            // Parse error details
            errorDetails = response.error.message || JSON.stringify(response.error);
            // Try to extract status from error context
            if (response.error.context?.status) {
              httpStatus = response.error.context.status;
            } else if (errorDetails.includes('404')) {
              httpStatus = 404;
            } else if (errorDetails.includes('500')) {
              httpStatus = 500;
            } else if (errorDetails.includes('401')) {
              httpStatus = 401;
            } else if (errorDetails.includes('non-2')) {
              // Edge function returned error status
              httpStatus = 500;
            }
          }

          const result: RateLimitResult = {
            attempt: i,
            allowed: response.error ? false : (response.data?.allowed ?? false),
            message: response.data?.message || response.error?.message,
            timestamp: new Date().toISOString(),
            httpStatus: httpStatus || (response.error ? 500 : 200),
            errorDetails: errorDetails,
          };

          setRateLimitResults(prev => [...prev, result]);
        } catch (innerError: any) {
          console.error(`Attempt ${i} exception:`, innerError);
          
          const result: RateLimitResult = {
            attempt: i,
            allowed: false,
            message: innerError.message,
            timestamp: new Date().toISOString(),
            httpStatus: 500,
            errorDetails: JSON.stringify(innerError, null, 2),
          };
          
          setRateLimitResults(prev => [...prev, result]);
        }

        // Small delay to see results updating
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast({
        title: 'Teste de Rate Limit concluído',
        description: '15 tentativas executadas',
      });
    } catch (error) {
      console.error('Rate limit test error:', error);
      toast({
        title: 'Erro no teste',
        description: 'Ocorreu um erro ao executar o teste de rate limit',
        variant: 'destructive',
      });
    } finally {
      setIsRateLimitRunning(false);
    }
  };

  // Cleanup test tickets
  const cleanupTestTickets = async () => {
    if (testTicketIds.length === 0) {
      toast({
        title: 'Nada para limpar',
        description: 'Não há tickets de teste para remover',
      });
      return;
    }

    setIsCleaningUp(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .in('id', testTicketIds);

      if (error) throw error;

      setTestTicketIds([]);
      setSlaResults([]);
      
      toast({
        title: 'Limpeza concluída',
        description: `${testTicketIds.length} tickets de teste removidos`,
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      toast({
        title: 'Erro na limpeza',
        description: 'Não foi possível remover os tickets de teste',
        variant: 'destructive',
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Update ticket status for audit test
  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: 'Verifique a tabela de auditoria para o novo registro',
      });
      
      // Refresh audit logs after a short delay
      setTimeout(fetchAuditLogs, 500);
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status',
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    };
    return <Badge className={colors[priority]}>{priority}</Badge>;
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              Esta página é restrita a desenvolvedores e administradores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">🛠️ Debug Tools</h1>
              <p className="text-muted-foreground">Ferramentas para validação de regras de negócio</p>
            </div>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Role: {role}
          </Badge>
        </div>

        {/* SLA Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Teste de SLA - calculate_sla_due_date()
            </CardTitle>
            <CardDescription>
              Cria tickets com diferentes prioridades e valida se o banco calcula corretamente a data de SLA.
              Esperado: Urgente (4h), Alta (24h), Média (48h), Baixa (72h)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runSlaTest} disabled={isSlaRunning} className="gap-2">
                {isSlaRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Simular Criação de Tickets
              </Button>
              {testTicketIds.length > 0 && (
                <Button variant="destructive" onClick={cleanupTestTickets} disabled={isCleaningUp} className="gap-2">
                  {isCleaningUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Limpar Tickets de Teste ({testTicketIds.length})
                </Button>
              )}
            </div>

            {slaResults.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>SLA Due Date</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead>Calculado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slaResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>#{result.ticket_number}</TableCell>
                      <TableCell>{getPriorityBadge(result.priority)}</TableCell>
                      <TableCell>{format(new Date(result.created_at), 'dd/MM HH:mm:ss')}</TableCell>
                      <TableCell>{format(new Date(result.sla_due_date), 'dd/MM HH:mm:ss')}</TableCell>
                      <TableCell>{result.expected_hours}h</TableCell>
                      <TableCell>{result.calculated_hours}h</TableCell>
                      <TableCell>
                        <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                          {result.status === 'success' ? '✅ OK' : '❌ Erro'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateTicketStatus(result.id, 'in-progress')}
                        >
                          Mudar Status (Audit Test)
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Rate Limit Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Teste de Rate Limit - check-rate-limit Edge Function
            </CardTitle>
            <CardDescription>
              Executa 15 chamadas rápidas ao rate limiter. Esperado: primeiras chamadas permitidas, 
              depois bloqueio (máx 10 tickets/hora ou cooldown de 2min)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runRateLimitTest} disabled={isRateLimitRunning} className="gap-2">
              {isRateLimitRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Executar 15 Tentativas
            </Button>

            {rateLimitResults.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {rateLimitResults.map((result) => (
                  <div
                    key={result.attempt}
                    className={`p-3 rounded-lg border text-center ${
                      result.allowed 
                        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                        : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                    }`}
                  >
                    <div className="font-bold">#{result.attempt}</div>
                    <div className="text-sm">{result.allowed ? '✅ Permitido' : '❌ Bloqueado'}</div>
                    {result.httpStatus && (
                      <div className={`text-xs font-mono font-bold ${
                        result.httpStatus === 200 ? 'text-green-600' :
                        result.httpStatus === 429 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        HTTP {result.httpStatus}
                      </div>
                    )}
                    {result.message && (
                      <div className="text-xs text-muted-foreground truncate" title={result.message}>
                        {result.message.slice(0, 25)}
                      </div>
                    )}
                    {result.errorDetails && result.httpStatus !== 200 && result.httpStatus !== 429 && (
                      <div className="text-xs text-red-500 mt-1 truncate" title={result.errorDetails}>
                        {result.errorDetails.slice(0, 40)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Teste de Auditoria - audit_log (Realtime)
            </CardTitle>
            <CardDescription>
              Exibe as últimas 5 entradas do log de auditoria. Ao alterar o status de um ticket acima, 
              um novo registro deve aparecer automaticamente aqui (via Supabase Realtime).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={fetchAuditLogs} disabled={isLoadingAudit} variant="outline" className="gap-2">
              {isLoadingAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar Manualmente
            </Button>

            {auditLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Mudanças</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.table_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            log.action === 'INSERT' ? 'default' : 
                            log.action === 'UPDATE' ? 'secondary' : 
                            'destructive'
                          }
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.record_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {log.action === 'UPDATE' && log.old_data && log.new_data ? (
                          <div className="text-xs space-y-1">
                            {Object.keys(log.new_data).filter(key => 
                              JSON.stringify(log.old_data[key]) !== JSON.stringify(log.new_data[key])
                            ).slice(0, 3).map(key => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span>{' '}
                                <span className="text-red-500 line-through">{JSON.stringify(log.old_data[key])}</span>{' '}
                                → <span className="text-green-500">{JSON.stringify(log.new_data[key])}</span>
                              </div>
                            ))}
                          </div>
                        ) : log.action === 'INSERT' && log.new_data ? (
                          <div className="text-xs text-muted-foreground">
                            Novo registro criado
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.changed_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {isLoadingAudit ? 'Carregando...' : 'Nenhum registro de auditoria encontrado'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DebugTools;
