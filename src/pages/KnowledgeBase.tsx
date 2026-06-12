import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Book, ChevronRight, Hash, Clock, ArrowRight, Sparkles, Plus, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

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

export default function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: role } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isGestor = role === 'admin' || role === 'developer';

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);

  const { data: articles, isLoading } = useQuery({
    queryKey: ['knowledge-articles', isGestor],
    queryFn: async () => {
      let query = supabase
        .from('knowledge_base_articles')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });
      
      if (!isGestor) {
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
    enabled: isGestor
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

  const uniqueCategories = Array.from(new Set(articles?.map(a => a.category) || []));

  const filteredArticles = articles?.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                         a.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-primary/5 border-b border-border/50 py-20 px-8">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full -mr-64 -mt-64 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/5 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="max-w-4xl mx-auto space-y-8 relative z-10 text-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Centro de Ajuda Inteligente</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter text-foreground md:text-6xl">
                Base de <span className="text-primary">Conhecimento</span>
              </h1>
              <p className="text-muted-foreground text-xl font-medium max-w-2xl mx-auto">
                Explore artigos técnicos, tutoriais e soluções testadas para acelerar o seu suporte.
              </p>
            </div>
            
            <div className="relative group max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none transition-colors group-focus-within:text-primary">
                <Search className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <Input 
                placeholder="Qual problema você está enfrentando?" 
                className="h-20 pl-16 pr-6 bg-background border-border/40 shadow-2xl shadow-primary/10 rounded-3xl text-xl focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap justify-center items-center gap-3">
              <Button 
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                className={cn(
                  "rounded-full px-6 h-10 font-bold text-xs uppercase tracking-widest transition-all",
                  selectedCategory === null && "shadow-lg shadow-primary/20"
                )}
                onClick={() => setSelectedCategory(null)}
              >
                Todos
              </Button>
              {uniqueCategories.map(cat => (
                <Button 
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "rounded-full px-6 h-10 font-bold text-xs uppercase tracking-widest transition-all",
                    selectedCategory === cat && "shadow-lg shadow-primary/20"
                  )}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              ))}

              {isGestor && (
                <div className="pl-4 ml-4 border-l border-border/40">
                  <Button 
                    onClick={() => {
                      setEditingArticle({ status: 'draft', is_public: true });
                      setIsEditorOpen(true);
                    }}
                    className="rounded-full px-6 h-10 font-bold text-xs uppercase tracking-widest gap-2"
                  >
                    <Plus className="w-4 h-4" /> Novo Artigo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="h-64 animate-pulse bg-muted/30 rounded-3xl border-none" />
                ))}
              </div>
            ) : filteredArticles?.length === 0 ? (
              <div className="text-center py-32 bg-muted/5 rounded-[40px] border-2 border-dashed border-border/40">
                <div className="w-20 h-20 bg-background rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border/40 shadow-xl">
                  <Book className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-2xl font-black">Nenhum artigo encontrado</h3>
                <p className="text-muted-foreground text-lg">Tente buscar por termos diferentes ou navegue por outra categoria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredArticles?.map(article => (
                  <Card key={article.id} className="group p-0 border-border/40 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 cursor-pointer rounded-[32px] bg-card/50 backdrop-blur-md relative overflow-hidden flex flex-col h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-[3] opacity-50 pointer-events-none" />
                    
                    <CardContent className="p-8 relative flex-1 flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={cn(
                          "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg",
                          article.status === 'draft' ? "bg-secondary/5 text-secondary border-secondary/20" : "bg-primary/5 text-primary border-primary/20"
                        )}>
                          {article.status === 'draft' ? 'Rascunho' : article.category}
                        </Badge>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{format(new Date(article.created_at), "dd MMM, yy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3 flex-1">
                        <h2 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors leading-[1.1] tracking-tight">
                          {article.title}
                        </h2>
                        <p className="text-sm text-muted-foreground/80 line-clamp-3 leading-relaxed font-medium">
                          {article.content.replace(/[#*`]/g, '')}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 py-4 border-t border-border/40 mt-auto">
                        {article.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 text-[10px] bg-background/50 border border-border/40 px-2 py-1 rounded-md text-muted-foreground/70 font-bold uppercase tracking-tighter">
                            <Hash className="w-2.5 h-2.5 opacity-40" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform duration-500">
                          Ler artigo <ArrowRight className="w-4 h-4" />
                        </div>
                        {isGestor && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(article)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(article.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor Dialog */}
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingArticle?.id ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-4 space-y-6 py-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input 
                  value={editingArticle?.title || ''} 
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Como configurar o proxy"
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

              <div className="space-y-2 flex-1 flex flex-col h-[400px]">
                <Label>Conteúdo (Markdown suportado)</Label>
                <Textarea 
                  className="flex-1 resize-none font-mono text-sm" 
                  value={editingArticle?.content || ''}
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="# Título Principal&#10;&#10;Seu texto aqui..."
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
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
