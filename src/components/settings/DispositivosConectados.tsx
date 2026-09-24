import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Laptop, Loader2, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { descreverDispositivo, type SessaoDoUsuario } from '@/lib/sessoes';

interface Props {
  sessoes: SessaoDoUsuario[];
  encerrando: string | null;
  onEncerrar: (id: string) => void;
}

const ehCelular = (ua: string | null) => /iPhone|iPad|Android|Mobile/i.test(ua ?? '');

/** Lista de acessos da conta com o botão de encerrar (menos o atual). */
export const ListaDeDispositivos: React.FC<Props> = ({ sessoes, encerrando, onEncerrar }) => (
  <ul className="space-y-2">
    {sessoes.map((s) => {
      const Icone = ehCelular(s.user_agent) ? Smartphone : Laptop;
      return (
        <li
          key={s.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Icone className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                {descreverDispositivo(s.user_agent)}
                {s.atual && <Badge variant="secondary">Este dispositivo</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.ip ? `IP ${s.ip} · ` : ''}
                usado {formatDistanceToNow(new Date(s.ultimo_uso), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
          {!s.atual && (
            <Button
              size="sm"
              variant="outline"
              className="sm:shrink-0"
              disabled={encerrando !== null}
              onClick={() => onEncerrar(s.id)}
            >
              {encerrando === s.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Encerrar acesso
            </Button>
          )}
        </li>
      );
    })}
  </ul>
);
