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
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserRole';

const ticketSchema = z.object({
  title: z.string().min(5, 'Título deve ter no mínimo 5 caracteres').max(100, 'Título muito longo'),
  category: z.string().min(1, 'Selecione uma categoria'),
  priority: z.enum(['low', 'medium', 'high'], { required_error: 'Selecione uma prioridade' }),
  description: z.string().min(20, 'Descrição deve ter no mínimo 20 caracteres').max(1000, 'Descrição muito longa'),
  department: z.string().min(1, 'Selecione um departamento'),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

const NewTicket = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create initial ticket update
      const { error: updateError } = await supabase
        .from('ticket_updates')
        .insert([{
          ticket_id: ticket.id,
          type: 'created',
          content: `Chamado criado por ${userInfo.name}`,
          author: '', // Placeholder - trigger will set display name
          author_id: user.id,
        }]);

      if (updateError) throw updateError;

      toast({
        title: 'Chamado criado com sucesso!',
        description: `Número do chamado: #${ticket.ticket_number}`,
      });
      
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Erro ao criar chamado',
        description: error.message || 'Ocorreu um erro ao criar o chamado.',
        variant: 'destructive',
      });
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
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
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
