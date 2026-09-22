import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSLAConfigs } from '@/hooks/useSLAConfigs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft, ArrowRight, Send, Loader2, Paperclip, CheckCircle2,
  ShieldCheck, BookOpen, ExternalLink, X, Clipboard,
  Layout, Mail, HardDrive, Cpu, Globe, MoreHorizontal, Crown, Clock, UserPlus, Printer
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { ArticleMarkdownRenderer } from '@/components/knowledge/ArticleMarkdownRenderer';
import { normalizarTituloChamado, normalizarDescricaoChamado } from '@/lib/normalizaTextoChamado';
import { useAvaliacaoPendente } from '@/hooks/useAvaliacaoPendente';
import { AvaliacaoPendenteDialog } from '@/components/ticket/AvaliacaoPendenteDialog';
import { FileUpload } from '@/components/ticket/FileUpload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';
import { ticketCreationSchema } from '@/lib/validation';
import { useErrorHandler } from '@/lib/useErrorHandler';
import { invokeOrionFunction } from '@/lib/orion-functions';
import { cn } from '@/lib/utils';
import { FERRAMENTAS_REMOTAS, campoDeIdRemoto } from '@/lib/ferramentaRemota';
import { estaNoHorarioDeAlmoco } from '@/lib/horarioDeAlmoco';
import { useKBSuggestions } from '@/hooks/useKBSuggestions';
import {
  perguntasDa, validarRespostas, respostasPreenchidas, montarDescricao, MAX_RESPOSTA,
  type Respostas,
} from '@/lib/perguntasPorCategoria';
import { comprimirImagem } from '@/lib/comprimirImagem';

// A abertura tem dois passos: o passo 1 é só a escolha da categoria, o passo
// 2 traz todo o resto num formulário só. Prioridade e departamento continuam
// derivados no envio -- ver onSubmit. Validar aqui campos que a tela não
// mostra travaria o formulário num erro que o usuário não teria como
// corrigir.
//
// A descrição não é mais digitada: ela é montada a partir das perguntas da
// categoria (ver src/lib/perguntasPorCategoria.ts), que têm validação própria.
const ticketSchema = ticketCreationSchema.pick({ title: true, category: true });
type TicketFormValues = z.infer<typeof ticketSchema>;

/** Prioridade de toda abertura pelo cliente. A equipe reclassifica depois. */
const PRIORIDADE_PADRAO = 'medium';

// 'infraestrutura' não está aqui de propósito -- só chamados abertos
// automaticamente pelo RMM usam esse valor (ver CATEGORY_LABELS em
// ticket-helpers.ts), nunca uma escolha manual do cliente.
const categories = [
  {
    id: 'erp',
    name: 'ERP',
    icon: Layout,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    description: 'Sistema Senior (Sapiens, Vetorh, Ronda, emissão de notas fiscais, faturamento, financeiro e relatórios).',
    examples: ['Senior Sapiens (Gestão Empresarial)', 'Senior Vetorh / Ronda (RH e Acesso)', 'Emissão de NF-e / Danfe / Boletos', 'Rotinas de faturamento e relatórios']
  },
  {
    id: 'email',
    name: 'E-mail',
    icon: Mail,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Contas de correio eletrônico, problemas no Outlook ou Webmail, envio/recebimento e configuração de contas.',
    examples: ['Outlook travando ou não abre', 'Não envia ou não recebe mensagens', 'Configuração de nova conta / senha', 'Caixa de entrada cheia']
  },
  {
    id: 'hardware',
    name: 'Hardware',
    icon: HardDrive,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    description: 'Diagnóstico de problemas físicos no computador, máquina que não liga, travamentos graves ou lentidão de hardware.',
    examples: ['Computador ou notebook não liga / desliga sozinho', 'Lentidão severa ou congelamentos do sistema', 'Upgrade ou solicitação de memória RAM / SSD', 'Superaquecimento ou barulho anormal no equipamento']
  },
  {
    id: 'software',
    name: 'Software',
    icon: Cpu,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    description: 'Instalação, atualização ou erros em programas, pacote Microsoft Office, Excel travando, Adobe e antivírus.',
    examples: ['Instalação / Atualização de programas', 'Excel, Word ou PowerPoint com erro', 'Adobe Acrobat / Leitor de PDF', 'Navegadores e antivírus']
  },
  {
    id: 'rede',
    name: 'Rede',
    icon: Globe,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    description: 'Sem conexão com a internet, Wi-Fi instável ou lento, falha ao acessar pastas na rede e impressoras conectadas.',
    examples: ['Sem acesso à internet ou Wi-Fi instável', 'Pasta compartilhada do servidor não abre', 'VPN não conecta', 'Site ou sistema web fora do ar']
  },
  {
    id: 'criacao_usuario',
    name: 'Criação de usuário',
    icon: UserPlus,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    description: 'Acesso para um novo colaborador ou acesso novo para quem já trabalha aí: Windows, Senior, e-mail, VPN.',
    examples: ['Novo colaborador começando', 'Usuário no Windows / rede', 'Usuário no Senior', 'Acesso à VPN']
  },
  {
    id: 'impressora',
    name: 'Impressora',
    icon: Printer,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    description: 'Impressora que não imprime, papel atolado, falta de toner, scanner ou impressora que sumiu da lista.',
    examples: ['Impressora não imprime', 'Papel atolado ou toner acabando', 'Scanner não digitaliza', 'Impressora não aparece no computador']
  },
  {
    id: 'outros',
    name: 'Outros',
    icon: MoreHorizontal,
    color: 'text-muted-foreground',
    bg: 'bg-muted/40',
    description: 'Solicitações gerais, dúvidas de informática, liberação de novos acessos ou assuntos não listados nas outras opções.',
    examples: ['Criação ou liberação de novos acessos', 'Dúvidas de uso em geral', 'Telefonia / Ramal', 'Outras solicitações de TI']
  },
];

const NewTicket = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const { data: userRole } = useUserRole();
  const { handleError } = useErrorHandler();
  const [searchParams] = useSearchParams();
  const urlMachineId = searchParams.get('machine_id');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda síncrona contra double-submit -- o estado isSubmitting é
  // assíncrono (commit de render), e um key-repeat do SO pode disparar
  // onKeyDown duas vezes antes do primeiro re-render aplicar o disabled do
  // botão. Um ref muda na hora, sem esperar o React.
  const isSubmittingRef = useRef(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [remoteId, setRemoteId] = useState('');
  // Sem valor inicial de propósito. Um default silencioso (TeamViewer, por
  // ser o que a base de conhecimento ensina primeiro) gravaria 'teamviewer'
  // em quem colou um endereço de AnyDesk sem olhar o seletor, e o técnico
  // abriria o programa errado. Ferramenta não informada é um dado honesto;
  // ferramenta errada não é.
  const [remoteTool, setRemoteTool] = useState<'teamviewer' | 'anydesk' | null>(null);
  const [erroFerramenta, setErroFerramenta] = useState(false);
  const [remotePassword, setRemotePassword] = useState('');
  // Passo 1 é só a categoria; passo 2 tem todo o resto num formulário só.
  const [step, setStep] = useState<1 | 2>(1);
  // Reavaliado de minuto em minuto: quem abre o formulário às 11h58 e demora a
  // escrever precisa ver o aviso aparecer, não ficar com a foto da montagem.
  const [noHorarioDeAlmoco, setNoHorarioDeAlmoco] = useState(() => estaNoHorarioDeAlmoco());
  const [avaliacaoDialogAberto, setAvaliacaoDialogAberto] = useState(false);
  // Respostas às perguntas da categoria, por id de pergunta.
  const [respostas, setRespostas] = useState<Respostas>({});
  const [errosRespostas, setErrosRespostas] = useState<Record<string, string>>({});
  const [complemento, setComplemento] = useState('');

  // Só cliente é bloqueado por avaliação pendente. Técnico abrindo chamado em
  // nome de alguém, e abertura automática por alerta crítico, não passam por
  // aqui -- e não deveriam: a regra existe para fechar o ciclo de feedback do
  // cliente, não para atrapalhar quem atende.
  // Marcado quando a pendência é resolvida no diálogo. É um ref, e não o
  // resultado da query, porque o reenvio acontece imediatamente depois do
  // insert -- antes de a invalidação do react-query voltar. Sem isso, o
  // usuário avalia e o mesmo diálogo reabre.
  const avaliacaoResolvidaRef = useRef(false);
  const ehCliente = userRole === 'customer';
  const { data: avaliacaoPendente } = useAvaliacaoPendente(ehCliente ? user?.id : undefined);
  // Usado só na tela de confirmação, para dizer ao cliente em quanto tempo
  // o chamado será atendido.
  const { data: activeSla } = useSLAConfigs();
  const [createdTicket, setCreatedTicket] = useState<{ id: string; number: number; priority: string } | null>(null);
  const [previewArticle, setPreviewArticle] = useState<any | null>(null);

  // ── Smart: VIP Client detection ─────────────────
  const { data: companyInfo } = useQuery({
    queryKey: ['company-info-vip', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase.from('companies').select('id, name, settings').eq('id', profile.company_id).single();
      if (error || !data) return null;
      const settings = data.settings as Record<string, unknown> | null;
      return { ...data, is_vip: settings?.is_vip === true };
    },
    enabled: !!profile?.company_id,
    staleTime: 60_000,
  });

  const isVIP = companyInfo?.is_vip === true;

  const userInfo = {
    name: profile?.full_name || '',
    email: profile?.email || user?.email || '',
    company: companyInfo?.name || '',
  };

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    mode: 'onChange',
    defaultValues: { title: '', category: '' },
  });

  // ── Paste (Ctrl + V) Image Handler ──────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = item.type.split('/')[1] || 'png';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const file = new File([blob], `screenshot-${timestamp}.${ext}`, { type: item.type });
            
            if (file.size <= 10 * 1024 * 1024) {
              pastedFiles.push(file);
            } else {
              toast({
                title: "Imagem muito grande",
                description: "A imagem colada ultrapassa o limite de 10MB.",
                variant: "destructive",
              });
            }
          }
        }
      }

      if (pastedFiles.length > 0) {
        setPendingFiles((prev) => {
          if (prev.length + pastedFiles.length > 5) {
            toast({
              title: "Limite de anexos atingido",
              description: "Você pode anexar no máximo 5 arquivos por chamado.",
              variant: "destructive",
            });
            const allowed = 5 - prev.length;
            return allowed > 0 ? [...prev, ...pastedFiles.slice(0, allowed)] : prev;
          }
          toast({
            title: "Imagem anexada da área de transferência",
            description: `${pastedFiles.length} imagem(ns) adicionada(s).`,
          });
          return [...prev, ...pastedFiles];
        });
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [toast]);

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Cliente VIP continua entrando como alta, como antes de a prioridade sair
  // da tela. Era um seletor pré-preenchido; virou derivação.
  const prioridadeDerivada = isVIP ? 'high' : PRIORIDADE_PADRAO;

  const watchedTitle = form.watch('title');

  const { rotulo: rotuloDoCampoRemoto, placeholder: placeholderDoCampoRemoto } =
    campoDeIdRemoto(remoteTool);

  const watchedCategory = form.watch('category');
  const categoriaEscolhida = categories.find((c) => c.id === watchedCategory);
  const { suggestions, isLoading: isSuggestionsLoading } = useKBSuggestions(watchedTitle, watchedCategory);



  const onSubmit = async (data: TicketFormValues) => {
    if (!user || !profile) return;
    if (isSubmittingRef.current) return;

    // Avaliação pendente barra a abertura. A válvula de escape original era a
    // prioridade urgent, que o cliente não escolhe mais desde que o formulário
    // virou tela única -- sobra o botão "pular avaliação" no próprio diálogo,
    // que é o que garante que ninguém fica preso.
    if (avaliacaoPendente && !avaliacaoResolvidaRef.current) {
      setAvaliacaoDialogAberto(true);
      return;
    }

    // Informar o ID sem dizer a ferramenta deixa o técnico com um número e
    // duas opções. ID de TeamViewer e endereço de AnyDesk são ambos
    // numéricos e do mesmo tamanho, então não dá para deduzir pelo formato.
    // Só cobra quem de fato preencheu o ID -- o bloco inteiro é opcional.
    if (remoteId.trim() && !remoteTool) {
      setErroFerramenta(true);
      toast({
        title: 'Escolha a ferramenta',
        description: 'Diga se o ID informado é do TeamViewer ou do AnyDesk.',
        variant: 'destructive',
      });
      return;
    }

    // Perguntas obrigatórias da categoria. Validadas aqui, e não no zod do
    // react-hook-form, porque a lista muda com a categoria escolhida.
    const erros = validarRespostas(data.category, respostas);
    setErrosRespostas(erros);
    const primeiroErro = Object.keys(erros)[0];
    if (primeiroErro) {
      document.getElementById(`pergunta-${primeiroErro}`)?.focus();
      toast({
        title: 'Faltam respostas',
        description: 'Responda as perguntas marcadas para o técnico já começar sabendo o que acontece.',
        variant: 'destructive',
      });
      return;
    }
    const preenchidas = respostasPreenchidas(data.category, respostas, normalizarDescricaoChamado);
    const descricao = montarDescricao(preenchidas, normalizarDescricaoChamado(complemento));

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      // Check rate limit. Em falha de rede na checagem, invokeOrionFunction
      // engole o erro e retorna data: null -- optamos por não bloquear a
      // criação do chamado por um blip transitório (a aplicação de rate
      // limit real fica no backend Go, com contador persistente), mas
      // registramos pra não passar batido em silêncio.
      const { data: rateLimitData } = await invokeOrionFunction<{ allowed: boolean; message: string }>('check-rate-limit');
      if (rateLimitData === null) {
        console.warn('[NewTicket] Checagem de rate limit falhou (rede/edge function) -- prosseguindo sem bloquear.');
      }
      if (rateLimitData && !rateLimitData.allowed) {
        toast({ title: 'Limite atingido', description: rateLimitData.message, variant: 'destructive' });
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      // Normalização na gravação, uma vez só. Ver src/lib/normalizaTextoChamado.ts
      // para por que aqui e não no trigger validate_ticket_input.
      const { data: ticket, error: ticketError } = await supabase.from('tickets').insert({
        title: normalizarTituloChamado(data.title),
        category: data.category,
        priority: prioridadeDerivada,
        description: descricao,
        requester_name: userInfo.name,
        department: profile?.department || 'Geral',
        status: 'open',
        user_id: user.id,
        company_id: profile.company_id,
        remote_id: remoteId.trim() || null,
        // Sem ID não existe ferramenta a registrar. Minúsculo porque o CHECK
        // tickets_remote_tool_valid é sensível a caixa -- 'TeamViewer' é
        // rejeitado com 23514.
        remote_tool: remoteId.trim() ? remoteTool : null,
        // Senha sem ID não serve para conectar em nada.
        remote_password: remoteId.trim() ? remotePassword.trim() || null : null,
        metadata: {
          ...(urlMachineId ? { machine_id: urlMachineId } : {}),
          formulario: { versao: 1, respostas: preenchidas },
        },
      }).select().single();

      if (ticketError) {
        throw ticketError;
      }

      console.log('Sucesso:', ticket);

      // Attachments logic
      if (pendingFiles.length > 0) {
        const failedUploads: string[] = [];
        for (const original of pendingFiles) {
          const file = await comprimirImagem(original);
          const fileExt = file.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('ticket-files').upload(fileName, file);
          if (uploadError) {
            console.error('[NewTicket] Falha ao enviar anexo:', file.name, uploadError);
            failedUploads.push(file.name);
            continue;
          }

          await supabase.from('ticket_attachments').insert({
            ticket_id: ticket.id,
            file_name: file.name,
            file_url: fileName,
            file_type: file.type,
            uploaded_by: user.id
          });
        }
        if (failedUploads.length > 0) {
          toast({
            title: failedUploads.length === 1 ? 'Um anexo não foi enviado' : `${failedUploads.length} anexos não foram enviados`,
            description: `Chamado criado normalmente, mas ${failedUploads.join(', ')} falhou ao enviar. Anexe novamente pela tela do chamado.`,
            variant: 'destructive',
          });
        }
      }

      // toast({ title: 'Chamado criado!', description: `Número: #${ticket.ticket_number}` });
      
      // Invalida estatísticas para atualizar o dashboard imediatamente
      queryClient.invalidateQueries({ queryKey: ['technician-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-tickets-enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['team-workload'] });
      
      setCreatedTicket({
        id: ticket.id,
        number: ticket.ticket_number,
        priority: ticket.priority
      });
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      console.error('Erro completo:', err);
      console.error('Mensagem:', err.message);
      console.error('Código:', err.code);

      // 42501 é a recusa da policy de INSERT em tickets. A mensagem crua do
      // Postgres ("new row violates row-level security policy") não diz nada
      // a quem está tentando abrir um chamado. A causa quase sempre é uma
      // destas duas, e as duas têm saída prática.
      const recusadoPelaPolicy = err.code === '42501' || /row-level security/i.test(err.message || '');
      toast({
        title: recusadoPelaPolicy ? 'Não foi possível abrir o chamado' : 'Erro ao criar chamado',
        description: recusadoPelaPolicy
          ? 'Avalie o último chamado encerrado antes de abrir um novo. Se já avaliou, confirme com o suporte se o seu usuário está vinculado à empresa certa.'
          : err.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNoHorarioDeAlmoco(estaNoHorarioDeAlmoco()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (createdTicket) {
    const slaHours = activeSla ? activeSla[`${createdTicket.priority}_hours` as keyof typeof activeSla] : 24;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-border/40 shadow-2xl shadow-primary/5 bg-card/50 backdrop-blur-sm animate-in zoom-in-95 duration-500">
          <CardContent className="pt-10 pb-8 px-8 text-center space-y-6">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-foreground">Chamado #{createdTicket.number} criado!</h2>
              <p className="text-muted-foreground font-medium">
                Prazo estimado de resposta: <span className="text-foreground font-bold">{slaHours}h</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Button onClick={() => navigate(`/ticket/${createdTicket.id}`)} className="h-12 w-full font-bold shadow-lg shadow-primary/20">
                Acompanhar Chamado
              </Button>
              <Button variant="outline" onClick={() => {
                setCreatedTicket(null);
                form.reset({ title: '', category: '' });
                setRespostas({});
                setErrosRespostas({});
                setComplemento('');
                setStep(1);
                setPendingFiles([]);
                setRemoteId('');
                setRemotePassword('');
              }} className="h-12 w-full font-bold">
                Abrir Outro Chamado
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
          {/* No passo 2 o voltar do topo faz o mesmo que "Trocar categoria"
              do rodapé: quem rola até o fim não precisa ser o único a achar
              o caminho de volta. No passo 1 sai do formulário. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 2 ? setStep(1) : navigate('/'))}
            disabled={isSubmitting}
            className="hover:bg-primary/5 transition-colors gap-2 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> {step === 2 ? 'Trocar categoria' : 'Voltar'}
          </Button>
        </div>

        <div className="space-y-1">
          <h1 ref={stepHeadingRef} tabIndex={-1} className="text-3xl font-black tracking-tighter text-foreground outline-none">Abrir Novo Chamado</h1>
          <p className="text-muted-foreground font-medium">
            Conte o que está acontecendo. A prioridade fica com a nossa equipe.
          </p>
        </div>

        {noHorarioDeAlmoco && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-100/60 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
          >
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Estamos no horário de almoço (12h às 14h)</p>
              <p className="text-sm">
                Pode abrir o chamado normalmente — ele entra na fila do mesmo jeito. Só a primeira
                resposta tende a demorar um pouco mais neste intervalo, porque a equipe está reduzida.
              </p>
            </div>
          </div>
        )}

        <div className={cn(
          "gap-8 items-start",
          (suggestions.length > 0 || isSuggestionsLoading)
            ? "grid grid-cols-1 lg:grid-cols-3"
            : "max-w-3xl mx-auto w-full"
        )}>
          <div className={cn(
            "space-y-6",
            (suggestions.length > 0 || isSuggestionsLoading) ? "lg:col-span-2" : "w-full"
          )}>
            <Card className="border-border/70 shadow-sm overflow-hidden bg-card">
              <CardContent className="p-4 md:p-8">
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Handled explicitly on the submit button
                }}
                onKeyDown={(e) => {
                  if (step === 2 && e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)(e);
                  }
                }}
                className="space-y-8"
              >
                {step === 1 && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">O que está acontecendo?</Label>
                      <span className="text-xs text-muted-foreground hidden sm:inline-block">Passe o mouse para ver detalhes</span>
                    </div>
                    <TooltipProvider delayDuration={150}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                        {categories.map((cat) => (
                          <Tooltip key={cat.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  if (cat.id !== watchedCategory) {
                                    setRespostas({});
                                    setErrosRespostas({});
                                  }
                                  form.setValue('category', cat.id, { shouldValidate: true });
                                  form.clearErrors('category');
                                }}
                                aria-label={`${cat.name}: ${cat.description}`}
                                className={cn(
                                  "relative group p-4 md:p-6 rounded-lg border-2 transition-all flex flex-col items-center gap-3 md:gap-4 text-center h-32 md:h-40 justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                  watchedCategory === cat.id
                                    ? "border-primary bg-primary/5 shadow-xl shadow-primary/10"
                                    : "border-border/40 bg-muted/20 hover:border-primary/20 hover:bg-muted/30"
                                )}
                              >
                                <div className={cn("p-3 rounded-xl transition-all group-hover:scale-110", cat.bg, cat.color)}>
                                  <cat.icon className="w-6 h-6" />
                                </div>
                                <span className="font-bold text-sm tracking-tight">{cat.name}</span>
                                {watchedCategory === cat.id && (
                                  <div className="absolute top-2 right-2">
                                    <CheckCircle2 className="w-5 h-5 text-primary fill-background" />
                                  </div>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={8}
                              className="max-w-xs p-3 space-y-2 bg-popover/95 backdrop-blur border border-border shadow-xl text-left"
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn("p-1 rounded-md", cat.bg, cat.color)}>
                                  <cat.icon className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-sm text-foreground">{cat.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {cat.description}
                              </p>
                              <div className="pt-1.5 border-t border-border/50">
                                <span className="text-[11px] font-semibold text-foreground/80 block mb-1">Exemplos comuns:</span>
                                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                                  {cat.examples.map((ex, idx) => (
                                    <li key={idx} className="truncate">{ex}</li>
                                  ))}
                                </ul>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>

                    {/* Helper explicativo da categoria selecionada */}
                    {categoriaEscolhida && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-foreground/90 animate-in fade-in slide-in-from-top-1 duration-200">
                        <categoriaEscolhida.icon className={cn("w-4 h-4 shrink-0 mt-0.5", categoriaEscolhida.color)} />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground">{categoriaEscolhida.name}: </span>
                          <span className="text-muted-foreground">{categoriaEscolhida.description}</span>
                        </div>
                      </div>
                    )}

                    {isVIP && (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-sm font-bold animate-in fade-in duration-500">
                        <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                        Cliente VIP — prioridade automática: <span className="uppercase">Alta</span>
                      </div>
                    )}

                    <FormField control={form.control} name="category" render={() => <FormMessage />} />
                  </section>

                  <div className="flex items-center justify-end pt-8 border-t border-border/40">
                    <Button
                      type="button"
                      onClick={async () => {
                        const valido = await form.trigger('category');
                        if (valido) setStep(2);
                      }}
                      className="h-12 px-10 rounded-xl font-bold gap-2 shadow-xl shadow-primary/25 tracking-tight"
                    >
                      Continuar <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                )}

                {step === 2 && (
                <>
                {categoriaEscolhida && (
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="text-muted-foreground font-semibold uppercase tracking-widest">Categoria</span>
                    <span className={cn("flex items-center gap-1.5 font-bold", categoriaEscolhida.color)}>
                      <categoriaEscolhida.icon className="w-4 h-4" />
                      {categoriaEscolhida.name}
                    </span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Título do chamado</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Resuma em poucas palavras"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            if (e.target.value.trim().length >= 5) {
                              form.clearErrors('title');
                            }
                          }}
                          className="h-14 text-lg bg-background border-border/60 focus-visible:ring-primary/20 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <section className="space-y-6" aria-labelledby="perguntas-titulo">
                  <div className="space-y-1">
                    <h2 id="perguntas-titulo" className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">
                      Conte os detalhes
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Essas respostas evitam que o técnico precise voltar a perguntar. As marcadas com * são obrigatórias.
                    </p>
                  </div>

                  {perguntasDa(watchedCategory).map((p) => {
                    const idCampo = `pergunta-${p.id}`;
                    const erro = errosRespostas[p.id];
                    const bruto = respostas[p.id];
                    const valor = typeof bruto === 'string' ? bruto : '';
                    const marcadas = Array.isArray(bruto) ? bruto : [];
                    const atualizar = (novoValor: string | string[]) => {
                      setRespostas((prev) => ({ ...prev, [p.id]: novoValor }));
                      if (erro) {
                        setErrosRespostas((prev) => {
                          const resto = { ...prev };
                          delete resto[p.id];
                          return resto;
                        });
                      }
                    };
                    const rotulo = (
                      <>
                        {p.rotulo}
                        {p.obrigatoria
                          ? <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
                          : <span className="ml-1.5 text-xs font-normal italic text-muted-foreground">Opcional</span>}
                      </>
                    );
                    const descritoPor = erro ? `${idCampo}-erro` : undefined;
                    return (
                      <div key={p.id} className="space-y-2">
                        {p.tipo === 'multipla' ? (
                          <fieldset aria-invalid={!!erro} aria-describedby={descritoPor}>
                            <legend className="text-sm font-semibold text-foreground mb-2">
                              {rotulo}
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">Marque quantas precisar</span>
                            </legend>
                            <div className="flex flex-wrap gap-2">
                              {p.opcoes?.map((opcao, i) => {
                                const marcada = marcadas.includes(opcao);
                                return (
                                  <label
                                    key={opcao}
                                    className={cn(
                                      'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors text-sm font-medium',
                                      marcada
                                        ? 'border-primary bg-primary/10 text-foreground'
                                        : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                                    )}
                                  >
                                    <input
                                      id={i === 0 ? idCampo : undefined}
                                      type="checkbox"
                                      value={opcao}
                                      checked={marcada}
                                      onChange={() =>
                                        atualizar(marcada ? marcadas.filter((m) => m !== opcao) : [...marcadas, opcao])
                                      }
                                      className="accent-primary"
                                    />
                                    {opcao}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ) : p.tipo === 'opcoes' ? (
                          <fieldset aria-invalid={!!erro} aria-describedby={descritoPor}>
                            <legend className="text-sm font-semibold text-foreground mb-2">{rotulo}</legend>
                            <div className="flex flex-wrap gap-2">
                              {p.opcoes?.map((opcao, i) => (
                                <label
                                  key={opcao}
                                  className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors text-sm font-medium',
                                    valor === opcao
                                      ? 'border-primary bg-primary/10 text-foreground'
                                      : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                                  )}
                                >
                                  <input
                                    id={i === 0 ? idCampo : undefined}
                                    type="radio"
                                    name={idCampo}
                                    value={opcao}
                                    checked={valor === opcao}
                                    onChange={() => atualizar(opcao)}
                                    required={p.obrigatoria}
                                    className="accent-primary"
                                  />
                                  {opcao}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ) : (
                          <>
                            <Label htmlFor={idCampo} className="text-sm font-semibold text-foreground">{rotulo}</Label>
                            {p.tipo === 'longa' ? (
                              <Textarea
                                id={idCampo}
                                value={valor}
                                placeholder={p.placeholder}
                                maxLength={MAX_RESPOSTA}
                                onChange={(e) => atualizar(e.target.value)}
                                aria-required={p.obrigatoria}
                                aria-invalid={!!erro}
                                aria-describedby={descritoPor}
                                className="min-h-[96px] text-base bg-background border-border/60 focus-visible:ring-primary/20 rounded-xl resize-y leading-relaxed"
                              />
                            ) : (
                              <Input
                                id={idCampo}
                                value={valor}
                                placeholder={p.placeholder}
                                maxLength={MAX_RESPOSTA}
                                onChange={(e) => atualizar(e.target.value)}
                                aria-required={p.obrigatoria}
                                aria-invalid={!!erro}
                                aria-describedby={descritoPor}
                                className="h-11 bg-background border-border/60 focus-visible:ring-primary/20 rounded-xl"
                              />
                            )}
                          </>
                        )}
                        {erro && (
                          <p id={`${idCampo}-erro`} className="text-xs font-medium text-destructive">{erro}</p>
                        )}
                      </div>
                    );
                  })}

                  <div className="space-y-2">
                    <Label htmlFor="pergunta-complemento" className="text-sm font-semibold text-foreground">
                      Mais alguma informação?
                      <span className="ml-1.5 text-xs font-normal italic text-muted-foreground">Opcional</span>
                    </Label>
                    <Textarea
                      id="pergunta-complemento"
                      value={complemento}
                      maxLength={MAX_RESPOSTA}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="O que você já tentou, horários em que acontece, qualquer detalhe que ajude"
                      className="min-h-[80px] text-base bg-background border-border/60 focus-visible:ring-primary/20 rounded-xl resize-y leading-relaxed"
                    />
                  </div>
                </section>

                <section className="p-6 bg-muted/10 border border-border/40 rounded-lg space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <h4 className="text-sm font-bold">Acesso Remoto (Opcional)</h4>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-muted-foreground mb-2">
                      Qual programa você usa?
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {FERRAMENTAS_REMOTAS.map((ferramenta) => {
                        const escolhida = remoteTool === ferramenta.valor;
                        return (
                          <label
                            key={ferramenta.valor}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors text-sm font-medium',
                              escolhida
                                ? ferramenta.corSelecionada
                                : ferramenta.corNaoSelecionada
                            )}
                          >
                            <input
                              type="radio"
                              name="remote_tool"
                              value={ferramenta.valor}
                              checked={escolhida}
                              onChange={() => {
                                setRemoteTool(ferramenta.valor);
                                setErroFerramenta(false);
                              }}
                              className={ferramenta.corPonto}
                            />
                            {ferramenta.rotulo}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="space-y-1.5">
                    <Label htmlFor="remote-id" className="text-xs font-semibold text-muted-foreground">
                      {rotuloDoCampoRemoto}
                    </Label>
                    <Input
                      id="remote-id"
                      placeholder={placeholderDoCampoRemoto}
                      value={remoteId}
                      onChange={(e) => {
                        setRemoteId(e.target.value);
                        if (!e.target.value.trim()) setErroFerramenta(false);
                      }}
                      className="bg-background border-border/40"
                      aria-invalid={erroFerramenta}
                      aria-describedby={erroFerramenta ? 'remote-tool-erro' : undefined}
                    />
                    {erroFerramenta && (
                      <p id="remote-tool-erro" className="text-xs font-medium text-destructive">
                        Escolha acima se esse ID é do TeamViewer ou do AnyDesk.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="remote-password" className="text-xs font-semibold text-muted-foreground">
                      Senha de acesso
                    </Label>
                    <Input
                      id="remote-password"
                      placeholder="Senha mostrada no programa"
                      value={remotePassword}
                      onChange={(e) => setRemotePassword(e.target.value)}
                      autoComplete="off"
                      className="bg-background border-border/40"
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Anexar evidências (opcional)</Label>
                  <div className="bg-muted/10 border-2 border-dashed border-border/60 rounded-lg p-6 transition-all hover:bg-muted/20 hover:border-primary/20">
                    <FileUpload
                      onFilesSelected={(files) => setPendingFiles(prev => [...prev, ...files])}
                      isUploading={isSubmitting}
                      maxFiles={5}
                      maxSizeMB={10}
                    />
                  </div>
                  {pendingFiles.length > 0 && (
                    <div className="flex gap-2 flex-wrap pt-2">
                      {pendingFiles.map((f, i) => (
                        <div key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-medium group">
                          <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[180px]">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => removePendingFile(i)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-1 p-0.5 rounded"
                            title="Remover anexo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clipboard className="w-4 h-4 text-primary shrink-0" />
                    <span>Você também pode colar capturas de tela com <kbd className="px-1.5 py-0.5 bg-background font-mono rounded border text-[11px] font-bold text-foreground">Ctrl + V</kbd>.</span>
                  </div>
                </section>

                <div className="flex items-center justify-between pt-8 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                    disabled={isSubmitting}
                    className="h-12 px-6 rounded-xl font-bold gap-2 text-muted-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" /> Trocar categoria
                  </Button>
                  <Button
                    key="btn-submit"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }}
                    disabled={isSubmitting}
                    className="h-12 px-10 rounded-xl font-bold gap-2 shadow-xl shadow-primary/25 tracking-tight"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {isSubmitting ? "Abrindo..." : "Abrir Chamado"}
                  </Button>
                </div>
                </>
                )}

              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      
      {(suggestions.length > 0 || isSuggestionsLoading) && (
        <div className="lg:col-span-1">
          {/* Suggestions Panel */}
          <Card className="border-border/40 shadow-2xl shadow-primary/5 overflow-hidden bg-card/50 backdrop-blur-sm sticky top-8 animate-in slide-in-from-right-8 duration-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Artigos Sugeridos
              </CardTitle>
              <CardDescription>Baseados no que você está relatando...</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {isSuggestionsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                suggestions.map((article) => (
                  <div key={article.id} className="p-4 bg-muted/30 border border-border/40 rounded-xl space-y-3">
                    <h4 className="font-bold text-sm leading-tight text-foreground">{article.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-3">{article.content}</p>
                    <div className="flex items-center justify-between pt-2">
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary px-2" onClick={() => setPreviewArticle(article)}>
                        Ler Artigo <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                      <Button variant="secondary" size="sm" className="h-8 text-xs font-bold bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => {
                        toast({ title: 'Que ótimo!', description: 'Ficamos felizes que o artigo resolveu seu problema.' });
                        navigate('/');
                      }}>
                        Isso resolveu!
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>

        {/* Informações do Solicitante */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 text-center pt-2">
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">Solicitante:</span>
            <span className="text-foreground/80">{userInfo.name || userInfo.email || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">Empresa:</span>
            <span className="text-foreground/80">{userInfo.company || 'Não vinculada'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">Nível de Acesso:</span>
            <span className="text-foreground/80">{
              userRole === 'developer' ? 'Desenvolvedor' :
              userRole === 'admin' ? 'Gestor' :
              userRole === 'technician' ? 'Técnico' :
              'Colaborador'
            }</span>
          </div>
        </div>

        {/* Modal de Prévia do Artigo da Base de Conhecimento */}
        <Dialog open={!!previewArticle} onOpenChange={(open) => !open && setPreviewArticle(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2 border-b border-border/40">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary shrink-0" />
                <span>{previewArticle?.title}</span>
              </DialogTitle>
              <DialogDescription>
                Artigo de autoatendimento da Base de Conhecimento
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 overflow-y-auto flex-1 text-sm leading-relaxed">
              {previewArticle?.content ? (
                <ArticleMarkdownRenderer content={previewArticle.content} />
              ) : (
                <p className="text-muted-foreground italic">Sem conteúdo disponível.</p>
              )}
            </div>

            <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 flex flex-row items-center justify-between sm:justify-between gap-3">
              <Button variant="outline" onClick={() => setPreviewArticle(null)}>
                Continuar abrindo chamado
              </Button>
              <Button 
                variant="default" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => {
                  setPreviewArticle(null);
                  toast({ title: 'Excelente!', description: 'Ficamos felizes que a solução ajudou você!' });
                  navigate('/');
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Isso resolveu meu problema!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {avaliacaoPendente && (
          <AvaliacaoPendenteDialog
            open={avaliacaoDialogAberto}
            onOpenChange={setAvaliacaoDialogAberto}
            chamado={avaliacaoPendente}
            onResolvido={() => {
              avaliacaoResolvidaRef.current = true;
              setAvaliacaoDialogAberto(false);
              // Retoma a abertura de onde parou, com o formulário intacto.
              void form.handleSubmit(onSubmit)();
            }}
          />
        )}
    </div>
  );
};

export default NewTicket;
