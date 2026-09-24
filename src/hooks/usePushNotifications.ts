import { useCallback, useEffect, useState } from 'react';
import { desligarPush, estadoAtual, ligarPush, type EstadoPush } from '@/lib/push';
import { toast } from '@/hooks/use-toast';

export const usePushNotifications = () => {
  const [estado, setEstado] = useState<EstadoPush | 'carregando'>('carregando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    estadoAtual()
      .then((e) => { if (ativo) setEstado(e); })
      .catch(() => { if (ativo) setEstado('desligado'); });
    return () => { ativo = false; };
  }, []);

  const ligar = useCallback(async () => {
    setOcupado(true);
    try {
      const novo = await ligarPush();
      setEstado(novo);
      if (novo === 'ligado') {
        toast({ title: 'Notificações ativadas', description: 'Você vai receber os avisos do Orion neste navegador, mesmo com o site fechado.' });
      } else if (novo === 'bloqueado') {
        toast({ title: 'Notificações bloqueadas', description: 'Libere as notificações do Orion nas configurações do navegador.', variant: 'destructive' });
      }
    } catch (erro) {
      console.error('[usePushNotifications] Falha ao ativar:', erro);
      // AbortError no subscribe = o navegador não alcançou o serviço de push.
      // Acontece no Brave, que vem com o push do Google desligado.
      const semServicoDePush = erro instanceof DOMException && erro.name === 'AbortError';
      const ehBrave = 'brave' in navigator;
      toast({
        title: 'Não foi possível ativar as notificações',
        description: semServicoDePush && ehBrave
          ? 'No Brave, ligue "Usar os serviços do Google para mensagens push" em brave://settings/privacy e reinicie o navegador.'
          : semServicoDePush
            ? 'O navegador não conseguiu falar com o serviço de notificações. Verifique se ele não está bloqueado nas configurações.'
            : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setOcupado(false);
    }
  }, []);

  const desligar = useCallback(async () => {
    setOcupado(true);
    try {
      setEstado(await desligarPush());
    } catch (erro) {
      console.error('[usePushNotifications] Falha ao desativar:', erro);
      toast({ title: 'Não foi possível desativar as notificações', variant: 'destructive' });
    } finally {
      setOcupado(false);
    }
  }, []);

  return { estado, ocupado, ligar, desligar };
};
