import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, Book, BookOpen, Clock, ArrowRight, Sparkles, Plus, Edit2, Trash2, 
  Ticket, Monitor, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { ArticleMarkdownRenderer } from '@/components/knowledge/ArticleMarkdownRenderer';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category_id: string | null;
  category: string;
  status: string;
  is_public: boolean;
  tags: string[] | null;
  created_at: string;
  read_time?: string;
  excerpt?: string;
}

const DEFAULT_ARTICLES: Article[] = [
  {
    id: 'default-1',
    title: 'Como abrir um chamado no Orion System',
    slug: 'como-abrir-um-chamado-no-orion-system',
    category_id: null,
    category: 'Chamados',
    status: 'published',
    is_public: true,
    tags: ['chamado', 'suporte', 'ticket', 'orion'],
    created_at: new Date().toISOString(),
    read_time: '2 min de leitura',
    excerpt: 'Passo a passo simples para registrar solicitações de atendimento técnico no Orion System e acompanhar em tempo real.',
    content: `# Como abrir um chamado no Orion System

Abrir um chamado no Orion System é simples e garante que sua solicitação seja direcionada imediatamente ao técnico responsável.

---

### Passo a Passo

1. **Acesse o Sistema**: Clique no botão **+ Novo Ticket** localizado no menu superior da aplicação.
2. **Preencha os Detalhes**:
   - **Título**: Descreva brevemente o problema (ex: *Erro ao imprimir relatório financeiro*).
   - **Categoria / Prioridade**: Selecione a categoria correta para agilizar o atendimento.
   - **Descrição**: Detalhe o que está acontecendo, mensagens de erro e o comportamento observado.
3. **Anexe Comprovantes ou Prints**: Se possível, adicione capturas de tela do erro.
4. **Enviar**: Clique em **Enviar Chamado**. 

---

> [!TIP]
> Você receberá notificações sobre cada atualização de status do seu chamado diretamente na plataforma e por e-mail.`
  },
  {
    id: 'default-2',
    title: 'Como permitir acesso remoto via TeamViewer',
    slug: 'como-permitir-acesso-remoto-via-teamviewer',
    category_id: null,
    category: 'Acesso Remoto',
    status: 'published',
    is_public: true,
    tags: ['teamviewer', 'acesso remoto', 'suporte'],
    created_at: new Date().toISOString(),
    read_time: '2 min de leitura',
    excerpt: 'Veja como localizar e repassar o ID e a Senha do TeamViewer para que a equipe de TI realize o acesso remoto seguro.',
    content: `# Como permitir acesso remoto via TeamViewer

O **TeamViewer** é a ferramenta oficial e padrão utilizada pela equipe de suporte técnico para se conectar ao seu computador de forma prática e segura.

---

### Passo a Passo (Ferramenta Principal: TeamViewer)

1. **Abra o TeamViewer**:
   - Procure pelo ícone do **TeamViewer** na sua área de trabalho ou no menu Iniciar do Windows (pré-instalado no seu computador).
2. **Localize as Credenciais**:
   - Na janela principal, sob a seção *Permitir Controle Remoto*, identifique os campos **Sua ID** (9 a 10 dígitos) e **Senha** temporária.
3. **Informe ao Técnico**:
   - Forneça a ID e a Senha para o analista no seu chamado aberto, chat corporativo ou atendimento telefônico.
4. **Mantenha o Aplicativo Aberto**:
   - Você poderá acompanhar toda a assistência em tempo real. A senha é alterada automaticamente ao fechar o programa.

---

### Opção de Contingência (AnyDesk)

Caso o **TeamViewer** esteja indisponível, bloqueado pela rede ou não instalado na sua máquina, utilize o **AnyDesk** como alternativa secundária:

1. **Abra o AnyDesk**: Inicie o programa pelo Menu Iniciar ou baixe pelo site oficial \`anydesk.com/pt\`.
2. **Identifique o Código**: Na seção *Este Dispositivo*, copie o código numérico de 9 dígitos.
3. **Informe ao Técnico**: Repasse esse código no seu chamado.
4. **Autorize a Conexão**: Clique no botão verde **Aceitar** ao receber a notificação do suporte.

---

> [!IMPORTANT]
> NUNCA forneça senhas ou códigos para desconhecidos fora dos canais oficiais de suporte do Orion System.`
  },
  {
    id: 'default-3',
    title: 'Como usar o AnyDesk como alternativa de acesso remoto',
    slug: 'como-usar-o-anydesk-como-alternativa-de-acesso-remoto',
    category_id: null,
    category: 'Acesso Remoto',
    status: 'published',
    is_public: true,
    tags: ['anydesk', 'acesso remoto', 'suporte', 'contingencia'],
    created_at: new Date().toISOString(),
    read_time: '2 min de leitura',
    excerpt: 'Saiba como disponibilizar seu Endereço AnyDesk para acesso de contingência caso o TeamViewer apresente bloqueios.',
    content: `# Como usar o AnyDesk como alternativa de acesso remoto

Caso o TeamViewer esteja indisponível ou bloqueado, o **AnyDesk** é utilizado como alternativa secundária para suporte remoto.

---

### Passo a Passo

1. **Abra o AnyDesk**:
   - Inicie o programa **AnyDesk** a partir da sua Área de Trabalho ou menu Iniciar.
2. **Identifique seu Endereço**:
   - Na tela inicial, abaixo de **Este Dispositivo**, identifique o número de 9 dígitos (ex: \`123 456 789\`).
3. **Envie o Código**:
   - Copie ou digite esse código para o técnico de TI encarregado do seu chamado.
4. **Autorize a Conexão**:
   - Uma solicitação de conexão aparecerá na sua tela. Clique no botão verde **Aceitar** para conceder a permissão.

---

> [!NOTE]
> Você pode encerrar o acesso a qualquer momento clicando em **Finalizar** na janela flutuante do AnyDesk.`
  },
  {
    id: 'default-4',
    title: 'Impressora aparece offline ou não imprime',
    slug: 'impressora-aparece-offline-ou-nao-imprime',
    category_id: null,
    category: 'Impressoras',
    status: 'published',
    is_public: true,
    tags: ['impressora', 'offline', 'spooler', 'hardware'],
    created_at: new Date().toISOString(),
    read_time: '3 min de leitura',
    excerpt: 'Guia prático com verificações básicas de cabos, reinicialização e limpeza da fila de impressão no Windows.',
    content: `# Impressora aparece offline ou não imprime

Se sua impressora parou de responder ou exibe a mensagem de status "Offline", siga os passos abaixo antes de abrir um chamado.

---

### Verificações Iniciais

1. **Alimentação e Cabos**:
   - Verifique se o cabo de energia está firme e se as luzes da impressora estão acesas.
   - Caso a impressora seja USB, desconecte e reconecte o cabo USB no computador.
2. **Reiniciar a Impressora**:
   - Desligue a impressora no botão, aguarde 10 segundos e ligue-a novamente.
3. **Limpar Fila de Impressão**:
   - Vá em *Painel de Controle > Dispositivos e Impressoras*.
   - Clique duas vezes na sua impressora e cancele documentos pendentes com status de erro.
4. **Verificar Conexão de Rede (Impressoras de Rede)**:
   - Certifique-se de que o cabo de rede RJ45 está conectado ou que o Wi-Fi da impressora está ativo.

---

> [!TIP]
> Se após estes passos a impressora continuar offline, abra um chamado informando o modelo exato da impressora e o nome do computador.`
  },
  {
    id: 'default-5',
    title: 'Internet lenta ou instável: testes rápidos',
    slug: 'internet-lenta-ou-instavel-testes-rapidos',
    category_id: null,
    category: 'Rede & Internet',
    status: 'published',
    is_public: true,
    tags: ['internet', 'rede', 'wifi', 'lentidao'],
    created_at: new Date().toISOString(),
    read_time: '2 min de leitura',
    excerpt: 'Aprenda a realizar testes de velocidade, reiniciar adaptadores e identificar se a oscilação é local ou geral.',
    content: `# Internet lenta ou instável: testes rápidos

Problemas de conexão podem afetar a velocidade do sistema. Realize os testes abaixo para diagnosticar rapidamente a falha.

---

### Diagnóstico Passo a Passo

1. **Testar Outros Sites**:
   - Acesse portais de teste de velocidade (como Fast.com ou Speedtest) para verificar a taxa de download e upload.
2. **Verificar o Cabo de Rede / Wi-Fi**:
   - Se usa cabo de rede, confira se as luzes da porta da placa de rede piscam na cor verde/amarela.
   - No Wi-Fi, desative a conexão de rede sem fio e conecte-a novamente.
3. **Reiniciar o Adaptador de Rede**:
   - No Windows, clique com o botão direito no ícone de rede na barra de tarefas > **Solucionar problemas de rede**.
4. **Reiniciar o Roteador / Switch (Se Aplicável)**:
   - Caso esteja em Home Office, desligue seu modem por 30 segundos e ligue novamente.

---

> [!WARNING]
> Se o problema afetar todos os setores da empresa, informe imediatamente a equipe de infraestrutura de TI.`
  },
  {
    id: 'default-6',
    title: 'Computador muito lento: soluções simples',
    slug: 'computador-muito-lento-solucoes-simples',
    category_id: null,
    category: 'Sistema',
    status: 'published',
    is_public: true,
    tags: ['sistema', 'lentidao', 'desempenho', 'windows'],
    created_at: new Date().toISOString(),
    read_time: '3 min de leitura',
    excerpt: 'Dicas para encerrar processos travados no Gerenciador de Tarefas, liberar memória RAM e reiniciar a máquina corretamente.',
    content: `# Computador muito lento: soluções simples

Lentidão extrema pode ocorrer devido ao acúmulo de processos no sistema ou falta de memória livre.

---

### Ações Recomendadas

1. **Reiniciar o Computador**:
   - Salve seus arquivos abertos e clique em *Iniciar > Ligar/Desligar > Reiniciar*. (Não utilize a opção Desligar se a inicialização rápida estiver ativa).
2. **Encerrar Programas Pesados**:
   - Pressione \`Ctrl + Shift + Esc\` para abrir o **Gerenciador de Tarefas**.
   - Na aba *Processos*, verifique se algum aplicativo está consumindo 100% de CPU ou Memória.
   - Selecione o programa travado e clique em **Finalizar tarefa**.
3. **Fechar Abas Excessivas no Navegador**:
   - Deixar dezenas de abas abertas no Chrome ou Edge consome muita RAM. Feche as abas que não estão em uso.
4. **Verificar Espaço em Disco**:
   - Abra *Este Computador* e garanta que o disco \`C:\` tenha pelo menos 15% de espaço livre.

---

> [!NOTE]
> Se a lentidão persistir mesmo após a reinicialização, abra um chamado para verificação de hardware (memória RAM ou SSD).`
  },
  {
    id: 'default-7',
    title: 'VPN corporativa (OpenVPN) não conecta: o que verificar',
    slug: 'vpn-corporativa-openvpn-nao-conecta-o-que-verificar',
    category_id: null,
    category: 'Segurança',
    status: 'published',
    is_public: true,
    tags: ['vpn', 'openvpn', 'seguranca', 'home office', 'conexao'],
    created_at: new Date().toISOString(),
    read_time: '2 min de leitura',
    excerpt: 'Passo a passo para conectar e resolver problemas no OpenVPN Community (arquivo .ovpn, credenciais e ícone na barra de tarefas).',
    content: `# VPN corporativa (OpenVPN) não conecta: o que verificar

O **OpenVPN (Community Edition)** é a nossa ferramenta oficial para estabelecer conexões seguras e criptografadas à rede e servidores da empresa durante o trabalho remoto ou externo.

---

### Passo a Passo para Solução (OpenVPN Community)

1. **Verifique sua Conexão Local de Internet**:
   - Garanta que sua internet residencial ou Wi-Fi esteja funcionando normalmente antes de tentar conectar a VPN.
2. **Localize o Ícone do OpenVPN GUI**:
   - No canto inferior direito da tela (na barra de tarefas do Windows, próximo ao relógio), clique na setinha de ícones ocultos (\`^\`).
   - Procure o ícone do **OpenVPN GUI** (representado por um computador com um pequeno cadeado).
3. **Conectar à VPN**:
   - Clique com o **botão direito** no ícone do OpenVPN GUI.
   - Selecione o perfil corporativo (\`.ovpn\`) e clique em **Conectar**.
   - Se solicitado, insira seu Usuário e Senha corporativos.
4. **Verifique a Cor do Ícone de Status**:
   - **Verde**: Conectado com sucesso! Seus acessos aos servidores, sistemas e pastas da empresa estão liberados.
   - **Amarelo**: Conectando ou autenticando credenciais.
   - **Vermelho / Cinza**: Desconectado ou com erro de conexão/autenticação.
5. **Reiniciar o Cliente OpenVPN**:
   - Clique com o botão direito no ícone do OpenVPN GUI perto do relógio e escolha **Sair**.
   - Abra o **OpenVPN GUI** novamente pelo Menu Iniciar (se necessário, clique com o botão direito no atalho e selecione *Executar como Administrador*).

---

> [!IMPORTANT]
> Se o ícone do OpenVPN exibir mensagens como *TLS Error*, *AUTH_FAILED* ou *Certificate Expired*, abra um chamado no Orion System anexando o print do erro para atualização da sua chave de acesso .ovpn.`
  },
  {
    id: 'default-8',
    title: 'E-mail não sincroniza ou mensagens não chegam',
    slug: 'e-mail-nao-sincroniza-ou-mensagens-nao-chegam',
    category_id: null,
    category: 'E-mail & Comunicação',
    status: 'published',
    is_public: true,
    tags: ['email', 'outlook', 'sincronizacao', 'mensagens'],
    created_at: new Date().toISOString(),
    read_time: '2 min de leitura',
    excerpt: 'Saiba como resolver problemas de caixa de entrada cheia, modo offline no Outlook e sincronização de contas.',
    content: `# E-mail não sincroniza ou mensagens não chegam

Atraso ou falha no recebimento de e-mails corporativos pode ser causado por modo offline ativado ou limite de cota atingido.

---

### Soluções Rápidas

1. **Verificar Modo Offline no Outlook**:
   - Vá na guia **Enviar / Receber** do Outlook e verifique se o botão **Trabalhar Offline** está marcado. Se estiver desativado, clique nele para reconectar.
2. **Checar a Pasta de Lixo Eletrônico / Spam**:
   - Mensagens importantes podem ter sido filtradas incorretamente. Verifique a pasta Spam.
3. **Verificar Cota de Armazenamento**:
   - Se a caixa de correio atingiu 100% de capacidade, você não receberá novas mensagens. Apague e-mails antigos com anexos pesados ou esvazie o *Lixo Eletrônico*.
4. **Acessar via Webmail**:
   - Teste o acesso ao e-mail através do navegador (Webmail/Outlook Web) para confirmar se o servidor de e-mail está operacional.

---

> [!TIP]
> Se o e-mail funcionar no Webmail mas não no Outlook desktop, abra um chamado para reconfiguração do perfil de e-mail.`
  }
];

export default function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const { data: role } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isAdmin = role === 'admin' || role === 'developer';

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);

  const { data: articles } = useQuery({
    queryKey: ['knowledge-articles', isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('knowledge_base_articles')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });
      
      if (!isAdmin) {
        query = query.eq('status', 'published').eq('is_public', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        category: a.categories?.name || 'Geral'
      })) as Article[];
    }
  });

  const { data: dbCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin
  });

  const saveMutation = useMutation({
    mutationFn: async (article: Partial<Article>) => {
      const isUpdate = !!article.id && !article.id.startsWith('default-');
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { data: companyData } = await supabase.rpc('get_user_company_id', { _user_id: userData.user.id });
      if (!companyData) throw new Error('Empresa não encontrada');

      if (isUpdate) {
        const { error } = await supabase.from('knowledge_base_articles').update({
          title: article.title,
          content: article.content,
          category_id: article.category_id,
          status: article.status,
          is_public: article.is_public ?? true,
          company_id: companyData,
          updated_by: userData.user.id
        }).eq('id', article.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('knowledge_base_articles').insert([{
          title: article.title || '',
          content: article.content || '',
          category_id: article.category_id,
          status: article.status,
          is_public: article.is_public ?? true,
          company_id: companyData,
          created_by: userData.user.id
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-articles'] });
      setIsEditorOpen(false);
      setEditingArticle(null);
      toast({ title: 'Sucesso', description: 'Artigo salvo com sucesso.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('knowledge_base_articles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-articles'] });
      toast({ title: 'Sucesso', description: 'Artigo excluído com sucesso.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const handleSave = () => {
    if (!editingArticle?.title || !editingArticle?.content || !editingArticle?.category_id) {
      toast({ title: 'Atenção', description: 'Preencha título, categoria e conteúdo.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(editingArticle);
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setIsEditorOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este artigo?')) {
      deleteMutation.mutate(id);
    }
  };

  // Combine database articles with fallback default articles
  const combinedArticles = useMemo(() => {
    if (!articles || articles.length === 0) {
      return DEFAULT_ARTICLES;
    }
    const list = [...articles];
    for (const def of DEFAULT_ARTICLES) {
      if (list.length >= 8) break;
      const exists = list.some(a => a.title.toLowerCase() === def.title.toLowerCase());
      if (!exists) {
        list.push(def);
      }
    }
    return list;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!search.trim()) return combinedArticles;
    const term = search.toLowerCase();
    return combinedArticles.filter(a => 
      a.title.toLowerCase().includes(term) || 
      a.content.toLowerCase().includes(term) ||
      a.category.toLowerCase().includes(term) ||
      (a.excerpt && a.excerpt.toLowerCase().includes(term))
    );
  }, [combinedArticles, search]);

  // At most 8 quick tutorial articles shown
  const displayArticles = filteredArticles.slice(0, 8);

  const openHighlightArticle = (index: number) => {
    const article = combinedArticles[index] || DEFAULT_ARTICLES[index];
    setReadingArticle(article);
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      <div className="flex-1 flex flex-col">
        
        {/* HERO SECTION */}
        <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-background border-b border-border/40 py-12 px-6 lg:px-12">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full -mr-64 -mt-64 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="max-w-4xl mx-auto space-y-6 relative z-10 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="p-2 bg-primary/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-semibold uppercase tracking-widest text-[10px]">
                BASE DE CONHECIMENTO
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Como podemos <span className="text-primary">ajudar você hoje?</span>
            </h1>
            
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Pesquise dúvidas frequentes, siga os guias passo a passo ou aprenda a permitir o acesso remoto do suporte.
            </p>
            
            {/* BUSCA DESTAQUE */}
            <div className="relative group max-w-2xl mx-auto pt-2">
              <div className="absolute inset-y-0 left-5 top-2 flex items-center pointer-events-none transition-colors group-focus-within:text-primary">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <Input 
                placeholder="Digite sua dúvida (ex: TeamViewer, impressora, abrir chamado)..." 
                className="h-16 pl-14 pr-6 bg-card/90 border-border/60 shadow-xl rounded-2xl text-lg focus-visible:ring-primary/30 transition-all placeholder:text-muted-foreground/60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* TOP 3 HIGHLIGHT CARDS */}
        {!search && (
          <div className="bg-muted/20 border-b border-border/40 py-8 px-6 lg:px-12">
            <div className="max-w-6xl mx-auto space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Guia Rápido & Principais Tutoriais</h2>
                  <p className="text-sm text-muted-foreground">Acesso direto aos recursos mais utilizados do suporte.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* CARD 1 DESTAQUE: COMO ABRIR UM CHAMADO */}
                <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card hover:border-emerald-500/40 transition-all shadow-md group relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Ticket className="w-24 h-24 text-emerald-500" />
                  </div>
                  
                  <CardContent className="p-6 space-y-4 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/15 rounded-full border border-emerald-500/30">
                      <Ticket className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Passo a Passo</span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        Como abrir um chamado
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Aprenda a solicitar atendimento técnico rápido e acompanhar a resolução do seu chamado no Orion System.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/40 text-xs text-foreground/80">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Clique no botão <strong>+ Novo Ticket</strong> no menu topo.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Descreva o problema e anexe prints se houver.</span>
                      </div>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0 relative z-10">
                    <Button 
                      variant="outline"
                      className="w-full justify-between font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 group-hover:border-emerald-500/60"
                      onClick={() => openHighlightArticle(0)}
                    >
                      Ver tutorial completo <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

                {/* CARD 2 DESTAQUE PRINCIPAL: ACESSO REMOTO VIA TEAMVIEWER */}
                <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/15 via-card to-card hover:border-blue-500/60 transition-all shadow-md group relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Monitor className="w-24 h-24 text-blue-500" />
                  </div>

                  <CardContent className="p-6 space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/15 rounded-full border border-blue-500/30">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Padrão Corporativo</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        Acesso Remoto (TeamViewer)
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Ferramenta oficial para o suporte técnico acessar seu computador com segurança e resolver seu problema.
                      </p>
                    </div>

                    <div className="bg-background/80 backdrop-blur-md rounded-xl p-3.5 border border-border/50 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Instrução Rápida:</span>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-bold">Obrigatório</Badge>
                      </div>
                      <p className="text-xs text-foreground/90 font-medium">
                        Abra o <strong>TeamViewer</strong> pré-instalado na máquina e informe sua <strong>ID</strong> e <strong>Senha</strong> no chamado.
                      </p>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0 relative z-10">
                    <Button 
                      className="w-full justify-between font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                      onClick={() => openHighlightArticle(1)}
                    >
                      Como liberar acesso TeamViewer <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

              </div>
            </div>
          </div>
        )}

        {/* CLEAN GRID OF AT MOST 8 QUICK TUTORIAL ARTICLES */}
        <div className="flex-1 p-6 lg:p-12 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {search ? `Resultados da busca: "${search}"` : 'Tutoriais e Artigos Rápidos'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Exibindo {displayArticles.length} artigo(s) essenciais de ajuda
                </p>
              </div>

              {isAdmin && (
                <Button 
                  onClick={() => {
                    setEditingArticle({ status: 'draft', is_public: true });
                    setIsEditorOpen(true);
                  }}
                  className="rounded-full px-4 h-9 font-semibold text-xs gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Novo Artigo
                </Button>
              )}
            </div>

            {displayArticles.length === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-3xl border-2 border-dashed border-border/40 space-y-4">
                <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mx-auto border border-border/40 shadow-sm">
                  <Book className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">Nenhum artigo encontrado</h3>
                  <p className="text-muted-foreground text-sm">Tente pesquisar com outros termos de busca.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Limpar Busca
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {displayArticles.map(article => (
                  <Card 
                    key={article.id} 
                    className="group border-border/60 hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer rounded-2xl bg-card relative overflow-hidden flex flex-col justify-between"
                    onClick={() => setReadingArticle(article)}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge 
                          variant="secondary" 
                          className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/15 border-0 shrink-0"
                        >
                          {article.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                          <Clock className="w-3 h-3 text-muted-foreground/70" />
                          <span>{article.read_time || '2 min de leitura'}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 pt-1">
                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {article.excerpt || article.content.replace(/[#*`>-]/g, '').trim()}
                        </p>
                      </div>
                    </CardContent>

                    <div className="px-5 pb-4 pt-3 flex items-center justify-between border-t border-border/40 mt-auto bg-muted/10">
                      <span className="text-xs font-semibold text-primary inline-flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                        Ler tutorial <ArrowRight className="w-3.5 h-3.5" />
                      </span>

                      {isAdmin && !article.id.startsWith('default-') && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEdit(article)} 
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="Editar artigo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(article.id)} 
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Excluir artigo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MODAL DE LEITURA DO ARTIGO */}
        <Dialog open={!!readingArticle} onOpenChange={() => setReadingArticle(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader className="space-y-2 border-b pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold uppercase border-primary/30 text-primary bg-primary/5">
                  {readingArticle?.category}
                </Badge>
                <span className="text-xs text-muted-foreground">• {readingArticle?.read_time || '2 min de leitura'}</span>
              </div>
              <DialogTitle className="text-2xl font-bold leading-tight">{readingArticle?.title}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
              <ArticleMarkdownRenderer 
                content={readingArticle?.content || ''} 
              />
            </div>

            <DialogFooter className="border-t pt-4 flex justify-end">
              <Button variant="outline" onClick={() => setReadingArticle(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDITOR DIALOG (ADMIN) */}
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingArticle?.id && !editingArticle.id.startsWith('default-') ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              <div className="space-y-2">
                <Label>Título do Artigo</Label>
                <Input 
                  value={editingArticle?.title || ''} 
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Como habilitar acesso remoto via TeamViewer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={editingArticle?.category_id || ''} 
                    onValueChange={(val) => setEditingArticle(prev => ({ ...prev, category_id: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {dbCategories?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={editingArticle?.status || 'draft'} 
                    onValueChange={(val) => setEditingArticle(prev => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="published">Publicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  checked={editingArticle?.is_public ?? true}
                  onCheckedChange={(checked) => setEditingArticle(prev => ({ ...prev, is_public: checked }))}
                />
                <Label>Artigo Público (Visível para Clientes)</Label>
              </div>

              <div className="space-y-2 flex-1 flex flex-col h-[350px]">
                <Label>Conteúdo do Artigo (Markdown)</Label>
                <Textarea 
                  className="flex-1 resize-none font-mono text-sm" 
                  value={editingArticle?.content || ''}
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Escreva o passo a passo com marcações markdown..."
                />
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar Artigo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
