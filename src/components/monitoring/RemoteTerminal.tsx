import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Terminal, Power } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCreateCommand } from '@/hooks/useMonitoring';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface Props {
  machineId: string | null;
  hostname: string | undefined;
  isOnline: boolean;
  userId?: string;
  userName?: string;
}

export const RemoteTerminal: React.FC<Props> = ({ machineId, hostname, isOnline, userId, userName }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const createCommand = useCreateCommand();

  useEffect(() => {
    if (!terminalRef.current) return;
    
    const term = new XTerm({
      cursorBlink: true,
      theme: { background: '#09090b', foreground: '#e4e4e7' },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 12,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    
    term.writeln('\x1b[33m[Orion Shell]\x1b[0m Aguardando inicialização...');
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    const handleResize = () => {
      fitAddon.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ cols: term.cols, rows: term.rows }));
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  const connectToTerminal = async () => {
    if (!machineId || !isOnline) {
      toast.warning('Máquina offline ou ID ausente.');
      return;
    }
    
    if (isConnected || isConnecting) return;
    setIsConnecting(true);
    
    try {
      // Pedir ao agente para iniciar a sessão reversa
      await createCommand.mutateAsync({
        machineId,
        command: 'orion-start-terminal',
        executed_by_user_id: userId,
        executed_by_name: userName ?? 'Técnico',
      });
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In development, the API url might be different, but assuming standard proxy or same host.
      const host = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).host : window.location.host;
      const wsUrl = `${protocol}//${host}/api/ws/terminal?machine_id=${encodeURIComponent(machineId)}`;

      // O endpoint exige autenticação. A API WebSocket do navegador não permite
      // header Authorization, e mandar o token na query string o exporia nos
      // logs de acesso do proxy — então ele vai no subprotocolo, que o servidor
      // lê de Sec-WebSocket-Protocol e ecoa de volta no handshake.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error('Sessão expirada. Faça login novamente para abrir o terminal.');
        setIsConnecting(false);
        return;
      }

      const ws = new WebSocket(wsUrl, ['orion-bearer', accessToken]);
      
      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        xtermRef.current?.reset();
        xtermRef.current?.writeln('\x1b[32m[Orion Shell]\x1b[0m Conexão estabelecida com sucesso.');
        toast.success('Terminal conectado!');
        
        // Send initial size
        if (xtermRef.current) {
          ws.send(JSON.stringify({ cols: xtermRef.current.cols, rows: xtermRef.current.rows }));
        }
      };
      
      ws.onmessage = async (evt) => {
        let text = evt.data;
        if (text instanceof Blob) {
          text = await text.text();
        }
        xtermRef.current?.write(text);
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        xtermRef.current?.writeln('\r\n\x1b[31m[Orion Shell]\x1b[0m Conexão encerrada.');
      };
      
      ws.onerror = () => {
        setIsConnecting(false);
        toast.error('Erro na conexão do terminal WebSocket.');
      };
      
      wsRef.current = ws;
      
      xtermRef.current?.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
      
    } catch (err: any) {
      setIsConnecting(false);
      toast.error('Falha ao iniciar terminal remoto: ' + err.message);
    }
  };
  
  const disconnectTerminal = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-xl', isOnline ? 'bg-green-500/10' : 'bg-red-500/10')}>
          <Terminal className={cn('w-5 h-5', isOnline ? 'text-green-600' : 'text-red-500')} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm">Terminal PTY Realtime</h4>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
            {isOnline ? 'Agente conectado — pronto para iniciar sessão' : 'Agente offline — terminal indisponível'}
          </p>
        </div>
        
        <Button
          onClick={isConnected ? disconnectTerminal : connectToTerminal}
          disabled={!isOnline || (isConnecting && !isConnected)}
          variant={isConnected ? 'destructive' : 'default'}
          className="font-bold gap-2 text-xs"
        >
          {isConnected ? (
            <>
              <Power className="w-3.5 h-3.5" />
              Desconectar
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              {isConnecting ? 'Conectando...' : 'Iniciar Sessão'}
            </>
          )}
        </Button>
      </div>

      <Separator className="border-border/20" />

      {/* Console output */}
      <div className="bg-[#09090b] rounded-xl font-mono text-[11px] overflow-hidden flex flex-col border border-zinc-800/80 shadow-2xl h-[400px]">
        {/* Terminal chrome bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-900 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 hover:bg-red-500 transition-colors cursor-pointer" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 hover:bg-yellow-500 transition-colors cursor-pointer" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 hover:bg-green-500 transition-colors cursor-pointer" />
            </div>
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
              {hostname ?? 'Console'} — PTY
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
             {isConnected ? (
                <span className="text-green-500 font-bold animate-pulse">● Conectado</span>
             ) : (
                <span className="text-zinc-600 font-bold">○ Desconectado</span>
             )}
          </div>
        </div>

        {/* XTerm container */}
        <div 
          ref={terminalRef} 
          className="flex-1 w-full h-full p-2 overflow-hidden custom-scrollbar"
        />
      </div>
    </section>
  );
};
