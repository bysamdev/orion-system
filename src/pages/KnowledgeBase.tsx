import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Book, ChevronRight, Hash, Clock, Tag } from 'lucide-react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  tags: string[] | null;
  created_at: string;
}

export default function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: articles, isLoading } = useQuery({
    queryKey: ['knowledge-articles'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('knowledge_articles' as any) as any)
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Article[];
    }
  });

  const categories = Array.from(new Set(articles?.map(a => a.category) || []));

  const filteredArticles = articles?.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                         a.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="bg-primary/5 border-b border-border/50 px-8 py-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight text-foreground">Base de Conhecimento</h1>
              <p className="text-muted-foreground text-lg">Encontre soluções rápidas para os seus problemas técnicos.</p>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-primary">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
              <Input 
                placeholder="Busque por artigos, tutoriais ou soluções..." 
                className="h-16 pl-12 pr-4 bg-background border-border/50 shadow-xl rounded-2xl text-lg focus-visible:ring-primary/20 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge 
                variant={selectedCategory === null ? "default" : "outline"}
                className="px-4 py-1.5 rounded-full cursor-pointer text-xs font-bold uppercase tracking-wider transition-all"
                onClick={() => setSelectedCategory(null)}
              >
                Todos
              </Badge>
              {categories.map(cat => (
                <Badge 
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="px-4 py-1.5 rounded-full cursor-pointer text-xs font-bold uppercase tracking-wider transition-all"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="h-48 animate-pulse bg-muted/30" />
                ))}
              </div>
            ) : filteredArticles?.length === 0 ? (
              <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border">
                <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border">
                  <Book className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">Nenhum artigo encontrado</h3>
                <p className="text-muted-foreground">Tente ajustar sua busca ou categoria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                {filteredArticles?.map(article => (
                  <Card key={article.id} className="group p-6 border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer rounded-2xl bg-card/50 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150" />
                    <div className="relative flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">{article.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-medium">{format(new Date(article.created_at), "dd MMM, yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                          {article.title}
                          <ChevronRight className="w-5 h-5 opacity-0 -translate-x-4 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                        </h2>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {article.content.replace(/[#*`]/g, '').slice(0, 160)}...
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {article.tags?.map(tag => (
                          <span key={tag} className="flex items-center gap-1 text-[10px] bg-background border border-border/50 px-2 py-0.5 rounded text-muted-foreground font-medium">
                            <Hash className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
