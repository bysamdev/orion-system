import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

// O que técnicos e gestores escolhem receber. Sem linha no banco = tudo ligado,
// menos chamados novos (desligado por padrão, liga-se aqui).
export type CategoriaDeAviso =
  | 'novos_chamados'
  | 'chamados_automaticos'
  | 'respostas'
  | 'mudancas_de_status'
  | 'notas_internas'
  | 'atribuicoes'
  | 'prioridade';

export type PreferenciasDeAviso = Record<CategoriaDeAviso, boolean>;

export const CATEGORIAS_DE_AVISO: { chave: CategoriaDeAviso; titulo: string; descricao: string }[] = [
  { chave: 'novos_chamados', titulo: 'Chamados novos', descricao: 'Quando um chamado é aberto' },
  { chave: 'chamados_automaticos', titulo: 'Chamados automáticos de alertas', descricao: 'Quando o monitoramento abre um chamado por alerta de servidor' },
  { chave: 'respostas', titulo: 'Respostas', descricao: 'Quando o cliente ou a equipe responde um chamado' },
  { chave: 'mudancas_de_status', titulo: 'Mudanças de status', descricao: 'Quando um chamado muda de status' },
  { chave: 'notas_internas', titulo: 'Notas internas', descricao: 'Quando alguém da equipe deixa uma nota interna' },
  { chave: 'atribuicoes', titulo: 'Atribuições', descricao: 'Quando um chamado ganha ou troca de responsável' },
  { chave: 'prioridade', titulo: 'Prioridade', descricao: 'Quando a prioridade de um chamado muda' },
];

const PADRAO: PreferenciasDeAviso = {
  novos_chamados: false,
  chamados_automaticos: true,
  respostas: true,
  mudancas_de_status: true,
  notas_internas: true,
  atribuicoes: true,
  prioridade: true,
};

export const usePreferenciasDeNotificacao = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const chave = ['preferencias-de-notificacao', user?.id];

  const { data: preferencias = PADRAO, isLoading } = useQuery({
    queryKey: chave,
    queryFn: async (): Promise<PreferenciasDeAviso> => {
      const { data, error } = await supabase
        .from('preferencias_de_notificacao')
        .select('novos_chamados, chamados_automaticos, respostas, mudancas_de_status, notas_internas, atribuicoes, prioridade')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? PADRAO;
    },
    enabled: !!user?.id,
  });

  const salvar = useMutation({
    mutationFn: async (novas: PreferenciasDeAviso) => {
      const { error } = await supabase
        .from('preferencias_de_notificacao')
        .upsert({ user_id: user!.id, ...novas, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    // Otimista: o botão muda na hora; se falhar, volta.
    onMutate: async (novas) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const anteriores = queryClient.getQueryData<PreferenciasDeAviso>(chave);
      queryClient.setQueryData(chave, novas);
      return { anteriores };
    },
    onError: (erro, _novas, contexto) => {
      console.error('[usePreferenciasDeNotificacao] Falha ao salvar:', erro);
      if (contexto?.anteriores) queryClient.setQueryData(chave, contexto.anteriores);
      toast({ title: 'Não foi possível salvar a preferência', description: 'Tente novamente em instantes.', variant: 'destructive' });
    },
  });

  const alternar = (categoria: CategoriaDeAviso, ligado: boolean) =>
    salvar.mutate({ ...preferencias, [categoria]: ligado });

  return { preferencias, isLoading, alternar };
};
