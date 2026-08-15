import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemGraphStore } from '@/lib/systemGraph/store';
import type { SystemEvent } from '@/lib/systemGraph/types';

type SocketStatus = 'connecting' | 'open' | 'closed';

const MAX_BACKOFF_MS = 15_000;

export function useSystemGraphSocket(): { status: SocketStatus } {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const applyEvent = useSystemGraphStore(s => s.applyEvent);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    const connect = async () => {
      if (stoppedRef.current) return;
      setStatus('connecting');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        // Sem sessão válida ainda (ex.: app recém carregou) — tenta de novo em breve
        // em vez de desistir, já que o AuthProvider pode terminar de resolver a
        // sessão logo em seguida.
        scheduleReconnect();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).host : window.location.host;
      const wsUrl = `${protocol}//${host}/api/ws/system-graph`;

      const ws = new WebSocket(wsUrl, ['orion-bearer', accessToken]);

      ws.onopen = () => {
        attemptRef.current = 0;
        setStatus('open');
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data) as SystemEvent;
          applyEvent(parsed);
        } catch {
          // Payload malformado — ignora este evento, não derruba a conexão.
        }
      };

      ws.onclose = () => {
        setStatus('closed');
        wsRef.current = null;
        if (!stoppedRef.current) scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    const scheduleReconnect = () => {
      const attempt = attemptRef.current++;
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      setTimeout(() => {
        if (!stoppedRef.current) connect();
      }, delay);
    };

    connect();

    return () => {
      stoppedRef.current = true;
      wsRef.current?.close();
    };
  }, [applyEvent]);

  return { status };
}
