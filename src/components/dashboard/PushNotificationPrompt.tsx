import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const CHAVE_DISPENSADO = 'orion.push.convite-dispensado';

function dispensadoAntes(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Convite para ativar as notificações no navegador, mostrado depois do login
 * enquanto o navegador não estiver inscrito. O pedido de permissão só sai no
 * clique (os navegadores bloqueiam pedido automático). "Agora não" guarda a
 * escolha neste navegador; dá para ligar depois em Configurações > Notificações.
 */
export const PushNotificationPrompt: React.FC = () => {
  const { estado, ocupado, ligar } = usePushNotifications();
  const [dispensado, setDispensado] = useState(dispensadoAntes);

  if (estado !== 'desligado' || dispensado) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, '1');
    } catch {
      // Sem armazenamento, o convite volta no próximo acesso; não é problema.
    }
    setDispensado(true);
  };

  return (
    <div
      role="region"
      aria-label="Ativar notificações"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Bell className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Receba os avisos dos seus chamados</p>
          <p className="text-xs text-muted-foreground">
            Ative as notificações para saber quando o status mudar, mesmo com o Orion fechado.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <Button size="sm" onClick={ligar} disabled={ocupado}>
          Ativar notificações
        </Button>
        <Button size="sm" variant="ghost" onClick={dispensar} aria-label="Agora não">
          Agora não
          <X className="h-4 w-4 ml-1" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;
