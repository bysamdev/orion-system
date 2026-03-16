import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Book, ChevronRight, Hash, Clock, Tag, ArrowRight, Sparkles } from 'lucide-react';
import { TopBar } from '@/components/dashboard/TopBar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
      const { data, error } = await supabase
        .from('knowledge_articles')
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
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      
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

            <div className="flex flex-wrap justify-center gap-3">
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
              {categories.map(cat => (
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
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-[3] opacity-50" />
                    
                    <CardContent className="p-8 relative flex-1 flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest rounded-lg">
                          {article.category}
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

                      <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform duration-500">
                        Ler artigo <ArrowRight className="w-4 h-4" />
                      </div>
                    </CardContent>
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
