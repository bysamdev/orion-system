import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserRole';

interface ArticleSuggestion {
  id: string;
  title: string;
  content: string;
  category: string;
  similarity?: number;
}

export function useKBSuggestions(query: string, category: string) {
  const [suggestions, setSuggestions] = useState<ArticleSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { data: profile } = useUserProfile();

  useEffect(() => {
    if (!query || query.length < 5 || !profile?.company_id) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        // NOTA: isto ainda NÃO é o RAG com pgvector. A RPC match_kb_articles e a
        // coluna `embedding` existem, mas nada popula os embeddings ainda — até
        // lá, a busca é textual.
        //
        // O termo é sanitizado antes de entrar no filtro: `.or()` recebe a
        // sintaxe de filtro do PostgREST como string, onde vírgula separa
        // condições e parênteses agrupam. Interpolar o texto cru fazia qualquer
        // busca com vírgula ("não abre, trava tudo") virar filtro malformado —
        // e permitia injetar condições arbitrárias no OR.
        const termo = query.replace(/[,()\\%_.:]/g, ' ').trim();
        if (!termo) {
          setSuggestions([]);
          return;
        }

        const { data, error } = await (supabase.from('knowledge_base_articles') as any)
          .select('id, title, content, category_id')
          .eq('company_id', profile.company_id)
          .or(`title.ilike.%${termo}%,content.ilike.%${termo}%`)
          .limit(3);

        if (error) throw error;
        setSuggestions((data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          category: item.category || item.category_id || ''
        })));
      } catch (err) {
        console.error('Error fetching KB suggestions:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceId = setTimeout(fetchSuggestions, 600);
    return () => clearTimeout(debounceId);
  }, [query, category, profile?.company_id]);

  return { suggestions, isLoading };
}
