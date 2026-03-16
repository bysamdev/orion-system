import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, Search, Edit2, Trash2, Check, X, 
  BookOpen, Tag, MessageSquare, Loader2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  tags: string[] | null;
  is_published: boolean;
}

export const KnowledgeBaseManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Article>>({
    title: '',
    slug: '',
    content: '',
    category: 'Geral',
    tags: [],
    is_published: true
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb-articles-admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('knowledge_articles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Article[];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Article>) => {
      if (editingId) {
        const { error } = await (supabase as any)
          .from('knowledge_articles')
          .update(data)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('knowledge_articles')
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-articles-admin'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-articles'] });
      toast({ title: editingId ? 'Artigo atualizado' : 'Artigo criado' });
      resetForm();
    },
    onError: (err) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('knowledge_articles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-articles-admin'] });
      toast({ title: 'Artigo removido' });
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({
      title: '',
      slug: '',
      content: '',
      category: 'Geral',
      tags: [],
      is_published: true
    });
  };

  const startEdit = (article: Article) => {
    setEditingId(article.id);
    setIsAdding(false);
    setFormData(article);
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({ 
      ...prev, 
      title, 
      slug: prev.id ? prev.slug : generateSlug(title) 
    }));
  };

  const filteredArticles = articles?.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) || 
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-6 rounded-[32px] border border-border/40 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-2xl font-black text-foreground">Gestão de Conhecimento</h2>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Crie e edite artigos da KB para seu time.</p>
        </div>
        {!isAdding && !editingId && (
          <Button onClick={() => setIsAdding(true)} className="rounded-2xl gap-2 h-12 px-6 shadow-xl shadow-primary/10">
            <Plus className="w-4 h-4" /> Novo Artigo
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <Card className="rounded-[40px] border-border/40 shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden border-2 border-primary/10">
          <CardHeader className="p-8 border-b border-border/40 bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black">{editingId ? 'Editar Artigo' : 'Novo Artigo'}</CardTitle>
                <CardDescription className="font-medium">Preencha os detalhes técnicos do artigo.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={resetForm} className="rounded-full hover:bg-background">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Título</label>
                <Input 
                  value={formData.title} 
                  onChange={handleTitleChange}
                  className="h-14 rounded-2xl border-border/40 bg-background/50 text-lg font-bold"
                  placeholder="Ex: Como configurar firewall"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Slug (URL)</label>
                <Input 
                  value={formData.slug} 
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="h-14 rounded-2xl border-border/40 bg-background/50 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoria</label>
                <Input 
                  value={formData.category} 
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="h-14 rounded-2xl border-border/40 bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tags (separadas por vírgula)</label>
                <Input 
                  value={formData.tags?.join(', ')} 
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()) }))}
                  className="h-14 rounded-2xl border-border/40 bg-background/50"
                  placeholder="rede, hardware, agent"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Conteúdo (Markdown)</label>
              <Textarea 
                value={formData.content} 
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="min-h-[300px] rounded-3xl border-border/40 bg-background/50 font-mono text-sm leading-relaxed p-6"
                placeholder="# Título do Artigo\n\nDescreva a solução aqui..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm} className="rounded-2xl h-12 px-8">Cancelar</Button>
              <Button 
                onClick={() => saveMutation.mutate(formData)} 
                disabled={saveMutation.isPending}
                className="rounded-2xl h-12 px-10 gap-2 shadow-xl shadow-primary/20"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingId ? 'Atualizar Artigo' : 'Publicar Artigo'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List Section */}
      <div className="bg-card/30 rounded-[40px] border border-border/40 overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar por título ou categoria..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 pl-12 rounded-2xl border-border/40 bg-background/50"
            />
          </div>
        </div>

        <div className="p-2 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
                <th className="text-left p-6">Título / Categoria</th>
                <th className="text-left p-6">Tags</th>
                <th className="text-left p-6">Status</th>
                <th className="text-right p-6">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                [1,2,3].map(i => <tr key={i} className="animate-pulse"><td colSpan={4} className="p-12 text-center text-xs font-bold text-muted-foreground/30 uppercase tracking-widest">Sincronizando Artigos...</td></tr>)
              ) : filteredArticles?.length === 0 ? (
                <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">Nenhum artigo encontrado.</td></tr>
              ) : (
                filteredArticles?.map(article => (
                  <tr key={article.id} className="group hover:bg-muted/30 transition-colors">
                    <td className="p-6">
                      <div className="space-y-1">
                        <p className="font-black text-foreground leading-none">{article.title}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{article.category}</p>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-wrap gap-1">
                        {article.tags?.map(tag => (
                          <Badge key={tag} variant="outline" className="text-[9px] font-bold border-border/60 bg-background/50">{tag}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-6">
                      <Badge className={cn("rounded-md font-black uppercase text-[9px] tracking-widest", article.is_published ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                        {article.is_published ? 'Publicado' : 'Rascunho'}
                      </Badge>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="outline" size="icon" onClick={() => startEdit(article)} className="rounded-xl border-border/40 hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(article.id)} className="rounded-xl border-border/40 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
