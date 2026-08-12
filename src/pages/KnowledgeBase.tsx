import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, Book, ChevronRight, Hash, Clock, ArrowRight, Sparkles, Plus, Edit2, Trash2, 
  Ticket, Monitor, HelpCircle, ExternalLink, Printer, Wifi, Laptop, Mail, ShieldAlert, CheckCircle2,
  AlertTriangle, Copy, FileText, ArrowUpRight
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
}

const CATEGORIES_LIST = [
  { name: 'Primeiros Passos', icon: Sparkles, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { name: 'Abrir Chamado', icon: Ticket, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { name: 'Acesso Remoto', icon: Monitor, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { name: 'Impressoras', icon: Printer, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { name: 'Rede & Internet', icon: Wifi, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  { name: 'Windows & Sistema', icon: Laptop, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
  { name: 'E-mail & Comunicação', icon: Mail, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
];

export default function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const { data: role } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isAdmin = role === 'admin' || role === 'developer';

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);

  const { data: articles, isLoading } = useQuery({
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
      const isUpdate = !!article.id;
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { data: companyData } = await supabase.rpc('get_user_company_id', { user_id: userData.user.id });
      if (!companyData) throw new Error('Empresa não encontrada');

      const payload = {
        title: article.title,
        content: article.content,
        category_id: article.category_id,
        status: article.status,
        is_public: article.is_public ?? true,
        company_id: companyData,
        ...(isUpdate ? { updated_by: userData.user.id } : { created_by: userData.user.id })
      };

      if (isUpdate) {
        const { error } = await supabase.from('knowledge_base_articles').update(payload).eq('id', article.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('knowledge_base_articles').insert([payload]);
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

  const filteredArticles = articles?.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                         a.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* HERO SECTION */}
        <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-background border-b border-border/40 py-16 px-6 lg:px-12">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full -mr-64 -mt-64 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="max-w-4xl mx-auto space-y-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/15 rounded-full border border-primary/20 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Centro de Ajuda Orion System</span>
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

            {/* SELETOR DE CATEGORIAS */}
            <div className="flex flex-wrap justify-center items-center gap-2 pt-4">
              <Button 
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                className={cn(
                  "rounded-full px-5 h-9 font-semibold text-xs transition-all",
                  selectedCategory === null && "shadow-md shadow-primary/20"
                )}
                onClick={() => setSelectedCategory(null)}
              >
                Todas as Categorias
              </Button>
              {CATEGORIES_LIST.map(cat => {
                const IconComponent = cat.icon;
                const isSelected = selectedCategory === cat.name;
                return (
                  <Button 
                    key={cat.name}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-full px-4 h-9 font-medium text-xs gap-1.5 transition-all",
                      isSelected && "shadow-md shadow-primary/20"
                    )}
                    onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    {cat.name}
                  </Button>
                );
              })}

              {isAdmin && (
                <div className="pl-3 ml-3 border-l border-border/50">
                  <Button 
                    onClick={() => {
                      setEditingArticle({ status: 'draft', is_public: true });
                      setIsEditorOpen(true);
                    }}
                    className="rounded-full px-5 h-9 font-semibold text-xs gap-2"
                  >
                    <Plus className="w-4 h-4" /> Novo Artigo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BANNER / CARDS DE DESTAQUE FIXOS (TEAMVIEWER + ABRIR CHAMADO) */}
        {!search && !selectedCategory && (
          <div className="bg-muted/20 border-b border-border/40 py-10 px-6 lg:px-12">
            <div className="max-w-6xl mx-auto space-y-8">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Guia Rápido & Principais Tutoriais</h2>
                  <p className="text-sm text-muted-foreground">Acesso direto aos recursos mais utilizados do suporte.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
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
                      onClick={() => setSearch('abrir chamado')}
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
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/15 rounded-full border border-blue-500/30">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Padrão Corporativo</span>
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
                        Abra o <strong>TeamViewer</strong> pré-instalado na sua máquina e forneça seu <strong>ID</strong> e <strong>Senha</strong> ao técnico no chamado.
                      </p>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0 relative z-10">
                    <Button 
                      className="w-full justify-between font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                      onClick={() => setSearch('TeamViewer')}
                    >
                      Como liberar acesso TeamViewer <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

                {/* CARD 3 SECUNDÁRIO / CONTINGÊNCIA: ANYDESK */}
                <Card className="border-amber-500/20 bg-card/60 hover:border-amber-500/40 transition-all shadow-sm group relative overflow-hidden flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/15 rounded-full border border-amber-500/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Opção de Contingência</span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-foreground">
                        Acesso Alternativo (AnyDesk)
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Utilize o AnyDesk caso o TeamViewer não esteja instalado ou apresente bloqueios na sua rede corporativa.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                      <p>
                        Abra o AnyDesk e passe o <strong>Endereço de 9 dígitos</strong> exibido na tela inicial para o suporte.
                      </p>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={() => setSearch('AnyDesk')}
                    >
                      Ver tutorial AnyDesk <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

              </div>
            </div>
          </div>
        )}

        {/* LISTA DE ARTIGOS DA BASE DE CONHECIMENTO */}
        <div className="flex-1 p-6 lg:p-12 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {selectedCategory ? `Artigos da Categoria: ${selectedCategory}` : search ? `Resultados da busca: "${search}"` : 'Todos os Artigos Disponíveis'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {filteredArticles?.length || 0} artigo(s) encontrado(s)
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="h-60 animate-pulse bg-muted/30 rounded-2xl border-none" />
                ))}
              </div>
            ) : filteredArticles?.length === 0 ? (
              <div className="text-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed border-border/40 space-y-4">
                <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mx-auto border border-border/40 shadow-sm">
                  <Book className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">Nenhum artigo encontrado</h3>
                  <p className="text-muted-foreground text-sm">Tente pesquisar com outros termos ou selecione outra categoria acima.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setSelectedCategory(null); }}>
                  Limpar Filtros
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArticles?.map(article => (
                  <Card 
                    key={article.id} 
                    className="group border-border/50 hover:border-primary/50 hover:shadow-xl transition-all duration-300 cursor-pointer rounded-2xl bg-card relative overflow-hidden flex flex-col justify-between"
                    onClick={() => setReadingArticle(article)}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {article.category}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDate(article.created_at, "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                          {article.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {article.content.replace(/[#*`]/g, '')}
                        </p>
                      </div>

                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {article.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] bg-muted/60 px-2 py-0.5 rounded-md text-muted-foreground font-medium">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>

                    <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-border/30 mt-auto">
                      <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Ler artigo completo <ChevronRight className="w-4 h-4" />
                      </span>

                      {isAdmin && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(article)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(article.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
                <Badge variant="outline" className="text-xs font-bold uppercase">{readingArticle?.category}</Badge>
                <span className="text-xs text-muted-foreground">• Criado em {readingArticle?.created_at && formatDate(readingArticle.created_at, "dd/MM/yyyy")}</span>
              </div>
              <DialogTitle className="text-2xl font-bold leading-tight">{readingArticle?.title}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
              <ArticleMarkdownRenderer 
                content={readingArticle?.content || ''} 
                onOpenTicket={() => {
                  setReadingArticle(null);
                  toast({
                    title: "Direcionando para abertura de chamado",
                    description: "Preencha as informações do seu ticket de atendimento."
                  });
                }}
              />
            </div>

            <DialogFooter className="border-t pt-4 flex justify-between items-center">
              <Button variant="outline" onClick={() => setReadingArticle(null)}>Fechar</Button>
              <Button onClick={() => { setReadingArticle(null); setSearch('abrir chamado'); }}>Precisa de ajuda? Abrir Chamado</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDITOR DIALOG (ADMIN) */}
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingArticle?.id ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
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
                      {/* Status */}
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

      </main>
    </div>
  );
}

