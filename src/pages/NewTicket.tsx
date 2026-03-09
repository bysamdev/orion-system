import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Loader2, Paperclip } from 'lucide-react';
import { FileUpload } from '@/components/ticket/FileUpload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserRole';
import { ticketCreationSchema } from '@/lib/validation';
import { useErrorHandler } from '@/lib/useErrorHandler';
import { useActiveContracts } from '@/hooks/useContracts';

const ticketSchema = ticketCreationSchema;

type TicketFormValues = z.infer<typeof ticketSchema>;

const NewTicket = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const { handleError } = useErrorHandler();
  const { data: activeContracts } = useActiveContracts(profile?.company_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [remoteId, setRemoteId] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; company: string }>({
    name: '',
    email: '',
    company: ''
  });
  
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user || !profile) return;

      // Buscar empresa do usuário
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single();

      setUserInfo({
        name: profile.full_name || '',
        email: profile.email || user.email || '',
        company: companyData?.name || ''
      });
    };

    fetchUserInfo();
  }, [user, profile]);
  
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      category: '',
      priority: 'medium',
      description: '',
      department: '',
    },
  });

  const onSubmit = async (data: TicketFormValues) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar autenticado para criar um chamado.',
        variant: 'destructive',
      });
      return;
    }

    if (!userInfo.name || !userInfo.email) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar suas informações. Tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Verificar rate limit antes de criar ticket
      const { data: rateLimitData, error: rateLimitError } = await supabase.functions.invoke(
        'check-rate-limit',
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      if (rateLimitError) {
        console.error('Rate limit check failed:', rateLimitError);
        // Continuar mesmo se rate limit falhar (graceful degradation)
      } else if (rateLimitData && !rateLimitData.allowed) {
        toast({
          title: 'Limite atingido',
          description: rateLimitData.message || 'Você atingiu o limite de chamados. Tente novamente mais tarde.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Insert the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          title: data.title,
          category: data.category,
          priority: data.priority,
          description: data.description,
          requester_name: userInfo.name,
          department: data.department,
          status: 'open',
          user_id: user.id,
          company_id: profile.company_id,
          remote_id: remoteId.trim() || null,
          remote_password: remotePassword.trim() || null,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Upload dos arquivos pendentes
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket-files')
            .upload(fileName, file);
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }
          
          const { data: urlData } = await supabase.storage
            .from('ticket-files')
            .createSignedUrl(fileName, 60 * 60 * 24); // 24 horas - URLs são regeneradas ao carregar anexos
          
          if (urlData?.signedUrl) {
            await supabase.from('ticket_attachments').insert({
              ticket_id: ticket.id,
              file_name: file.name,
              file_url: urlData.signedUrl,
              file_type: file.type,
              uploaded_by: user.id
            });
          }
        }
      }

      // Sucesso - chamado criado
      toast({
        title: 'Chamado criado com sucesso!',
        description: `Número do chamado: #${ticket.ticket_number}`,
      });
      
      navigate('/');
    } catch (error: any) {
      handleError(error, 'NewTicket.onSubmit', 'Erro ao criar chamado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </Button>
        
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Novo Chamado</CardTitle>
            <CardDescription>
              Preencha o formulário abaixo para abrir um novo chamado de suporte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Informações do usuário - Read-only */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nome do Solicitante</label>
                    <p className="mt-1 text-base font-medium text-foreground">{userInfo.name || 'Carregando...'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="mt-1 text-base font-medium text-foreground">{userInfo.email || 'Carregando...'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Empresa</label>
                    <p className="mt-1 text-base font-medium text-foreground">{userInfo.company || 'Carregando...'}</p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do Chamado *</FormLabel>
                      <FormControl>
                        <Input placeholder="Descreva o problema brevemente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="erp">ERP</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="hardware">Hardware</SelectItem>
                            <SelectItem value="software">Software</SelectItem>
                            <SelectItem value="rede">Rede</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="urgent">🔴 Urgente (SLA: 4h)</SelectItem>
                            <SelectItem value="high">🟠 Alta (SLA: 24h)</SelectItem>
                            <SelectItem value="medium">🟡 Média (SLA: 48h)</SelectItem>
                            <SelectItem value="low">🟢 Baixa (SLA: 72h)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ti">TI</SelectItem>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                            <SelectItem value="rh">RH</SelectItem>
                            <SelectItem value="operacional">Operacional</SelectItem>
                            <SelectItem value="comercial">Comercial</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Problema *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva detalhadamente o problema que você está enfrentando..."
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dados para Acesso Remoto (Opcional) */}
                <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">
                      Dados para Acesso Remoto (Opcional)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Se precisar de suporte remoto, preencha os dados do TeamViewer ou AnyDesk. 
                      Use apenas senhas temporárias de sessão.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        ID (AnyDesk/TeamViewer)
                      </label>
                      <Input
                        placeholder="Ex: 123 456 789"
                        value={remoteId}
                        onChange={(e) => setRemoteId(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Senha de Acesso
                      </label>
                      <Input
                        placeholder="Senha temporária"
                        value={remotePassword}
                        onChange={(e) => setRemotePassword(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                  </div>
                </div>

                {/* Área de Upload de Arquivos */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Anexos (opcional)
                  </label>
                  <FileUpload
                    onFilesSelected={(files) => setPendingFiles(prev => [...prev, ...files])}
                    isUploading={isSubmitting}
                    maxFiles={5}
                    maxSizeMB={10}
                  />
                  {pendingFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {pendingFiles.length} arquivo(s) será(ão) enviado(s) com o chamado
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/')}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="gap-2" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Send className="w-4 h-4" />
                    Abrir Chamado
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NewTicket;
