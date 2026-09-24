import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { acessosAcimaDoLimite, type SessaoDoUsuario } from '@/lib/sessoes';

// De quanto em quanto tempo o app confere se este acesso foi encerrado em
// outro dispositivo. O token de acesso continua válido até expirar, então sem
// esta checagem o aparelho derrubado seguiria usando o Orion por até 1 hora.
const INTERVALO_DE_CHECAGEM_MS = 60_000;

export const useSessoes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ['minhas-sessoes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_sessoes');
      if (error) throw error;
      return (data ?? []) as SessaoDoUsuario[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const encerrar = useMutation({
    mutationFn: async (sessaoId: string) => {
      const { error } = await supabase.rpc('encerrar_sessao', { p_sessao: sessaoId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-sessoes'] });
      toast({ title: 'Acesso encerrado', description: 'O outro dispositivo sai do Orion em até 1 minuto.' });
    },
    onError: (erro) => {
      console.error('[useSessoes] Falha ao encerrar acesso:', erro);
      toast({ title: 'Não foi possível encerrar o acesso', description: 'Tente novamente em instantes.', variant: 'destructive' });
    },
  });

  return {
    sessoes,
    isLoading,
    excesso: acessosAcimaDoLimite(sessoes),
    encerrar: encerrar.mutate,
    encerrando: encerrar.isPending ? encerrar.variables : null,
  };
};

// Sai deste dispositivo quando o acesso dele foi encerrado em outro.
export const useVigiaDeSessao = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    let ativo = true;

    const conferir = async () => {
      const { data, error } = await supabase.rpc('sessao_atual_ativa');
      // Erro de rede não derruba ninguém; só a resposta explícita "false".
      if (!ativo || error || data !== false) return;
      await supabase.auth.signOut({ scope: 'local' });
      toast({ title: 'Seu acesso foi encerrado', description: 'Este dispositivo foi desconectado a partir de outro aparelho.' });
      navigate('/auth', { replace: true });
    };

    const timer = window.setInterval(conferir, INTERVALO_DE_CHECAGEM_MS);
    return () => { ativo = false; window.clearInterval(timer); };
  }, [user?.id, navigate]);
};
