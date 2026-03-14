import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Send, Loader2, Paperclip, CheckCircle2, 
  Cpu, Mail, HardDrive, Globe, MoreHorizontal, Layout,
  ChevronRight, ChevronLeft, ShieldCheck, AlertCircle
} from 'lucide-react';
import { FileUpload } from '@/components/ticket/FileUpload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';
import { ticketCreationSchema } from '@/lib/validation';
import { useErrorHandler } from '@/lib/useErrorHandler';
import { useActiveContracts } from '@/hooks/useContracts';
import { invokeOrionFunction } from '@/lib/orion-functions';
import { cn } from '@/lib/utils';

const ticketSchema = ticketCreationSchema;
type TicketFormValues = z.infer<typeof ticketSchema>;

const categories = [
  { id: 'erp', name: 'ERP', icon: Layout, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'email', name: 'E-mail', icon: Mail, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'hardware', name: 'Hardware', icon: HardDrive, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'software', name: 'Software', icon: Cpu, color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'rede', name: 'Rede', icon: Globe, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'outros', name: 'Outros', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-500/10' },
];

const NewTicket = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const { data: userRole } = useUserRole();
  const { handleError } = useErrorHandler();
  const { data: activeContracts } = useActiveContracts(profile?.company_id);
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [remoteId, setRemoteId] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [userInfo, setUserInfo] = useState({ name: '', email: '', company: '' });

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user || !profile) return;
      const { data: companyData } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
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
    defaultValues: { title: '', category: '', priority: 'medium', description: '', department: '' },
  });

  const currentCategory = form.watch('category');

  const onSubmit = async (data: TicketFormValues) => {
    if (!user || !profile) return;
    setIsSubmitting(true);
    try {
      // Check rate limit
      const { data: rateLimitData } = await invokeOrionFunction<any>('check-rate-limit');
      if (rateLimitData && !rateLimitData.allowed) {
        toast({ title: 'Limite atingido', description: rateLimitData.message, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      const { data: ticket, error: ticketError } = await supabase.from('tickets').insert({
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
        contract_id: selectedContractId || null,
      }).select().single();

      if (ticketError) throw ticketError;

      // Attachments logic
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('ticket-files').upload(fileName, file);
          if (uploadError) continue;
          const { data: urlData } = await supabase.storage.from('ticket-files').createSignedUrl(fileName, 60 * 60 * 24);
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

      toast({ title: 'Chamado criado!', description: `Número: #${ticket.ticket_number}` });
      navigate('/');
    } catch (error: any) {
      handleError(error, 'NewTicket.onSubmit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    const fieldsToValidate = step === 1 ? ['category', 'title'] : ['description', 'priority', 'department'];
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      
      <main className="flex-1 p-6 lg:p-12 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="hover:bg-primary/5 transition-colors gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={cn(
                  "h-1.5 w-8 rounded-full transition-all duration-500",
                  step >= s ? "bg-primary" : "bg-muted"
                )} 
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Abrir Novo Chamado</h1>
          <p className="text-muted-foreground font-medium">Passo {step} de 3 — {
            step === 1 ? "Identificação do problema" : 
            step === 2 ? "Detalhes e priorização" : 
            "Anexos e finalização"
          }</p>
        </div>

        <Card className="border-border/40 shadow-2xl shadow-primary/5 overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                {step === 1 && (
                  <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <section className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">O que está acontecendo?</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => form.setValue('category', cat.id)}
                            className={cn(
                              "relative group p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 text-center h-40 justify-center overflow-hidden",
                              currentCategory === cat.id 
                                ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" 
                                : "border-border/40 bg-muted/20 hover:border-primary/20 hover:bg-muted/30"
                            )}
                          >
                            <div className={cn("p-3 rounded-xl transition-all group-hover:scale-110", cat.bg, cat.color)}>
                              <cat.icon className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-sm tracking-tight">{cat.name}</span>
                            {currentCategory === cat.id && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle2 className="w-5 h-5 text-primary fill-background" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <FormField control={form.control} name="category" render={() => <FormMessage />} />
                    </section>

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Título do chamado</FormLabel>
                          <FormControl>
                            <Input placeholder="Resuma em poucas palavras" {...field} className="h-14 text-lg bg-background border-border/60 focus-visible:ring-primary/20 rounded-xl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Descrição detalhada</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Conte-nos o que aconteceu, erros exibidos e o que você já tentou..."
                              className="min-h-[180px] text-base bg-background border-border/60 focus-visible:ring-primary/20 rounded-xl resize-none leading-relaxed"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Qual a urgência?</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-background border-border/60 rounded-xl">
                                  <SelectValue />
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
                          <FormItem className="space-y-4">
                            <FormLabel className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Seu Departamento</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-background border-border/60 rounded-xl">
                                  <SelectValue />
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

                    <section className="p-6 bg-muted/10 border border-border/40 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <h4 className="text-sm font-bold">Acesso Remoto (Opcional)</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input placeholder="ID (AnyDesk/TeamViewer)" value={remoteId} onChange={(e) => setRemoteId(e.target.value)} className="bg-background border-border/40" />
                        <Input placeholder="Senha temporária" value={remotePassword} onChange={(e) => setRemotePassword(e.target.value)} className="bg-background border-border/40" />
                      </div>
                    </section>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <section className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Anexar evidências</Label>
                      <div className="bg-muted/10 border-2 border-dashed border-border/60 rounded-2xl p-6 transition-all hover:bg-muted/20 hover:border-primary/20">
                        <FileUpload
                          onFilesSelected={(files) => setPendingFiles(prev => [...prev, ...files])}
                          isUploading={isSubmitting}
                          maxFiles={5}
                          maxSizeMB={10}
                        />
                      </div>
                      {pendingFiles.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {pendingFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-medium">
                              <Paperclip className="w-3 h-3 text-muted-foreground" />
                              {f.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {activeContracts && activeContracts.length > 0 && (
                      <section className="space-y-4">
                        <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Vincular a Contrato</Label>
                        <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                          <SelectTrigger className="h-12 bg-background border-border/60 rounded-xl">
                            <SelectValue placeholder="Selecione um contrato" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeContracts.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </section>
                    )}

                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <AlertCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-primary">Confira seus dados e finalize</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">Seu chamado será atribuído automaticamente a um técnico disponível. Você receberá atualizações em tempo real.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-8 border-t border-border/40">
                  <div className="flex items-center gap-4">
                    {step > 1 && (
                      <Button type="button" variant="outline" onClick={prevStep} className="h-12 px-6 rounded-xl gap-2 font-bold decoration-transparent tracking-tight">
                        <ChevronLeft className="w-4 h-4" /> Anterior
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {step < 3 ? (
                      <Button type="button" onClick={nextStep} className="h-12 px-8 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20 tracking-tight">
                        Próximo <ChevronRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-xl font-bold gap-2 shadow-xl shadow-primary/25 tracking-tight">
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        {isSubmitting ? "Enviando..." : "Abrir Chamado"}
                      </Button>
                    )}
                  </div>
                </div>

              </form>
            </Form>
          </CardContent>
        </Card>

        {/* User Info Footnote */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 text-center md:text-left">
          <div className="flex items-center gap-2">
            <span className="text-primary opacity-40">Requester</span>
            <span>{userInfo.name || '---'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary opacity-40">Organization</span>
            <span>{userInfo.company || '---'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary opacity-40">Auth Level</span>
            <span>{userRole || 'User'}</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewTicket;
