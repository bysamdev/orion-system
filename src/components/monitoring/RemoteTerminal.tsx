import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Play, RefreshCw, Trash2, Copy, Clock,
  Terminal, Network, Activity, Cpu, Monitor, HardDrive,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCreateCommand, useMachineCommands } from '@/hooks/useMonitoring';
import type { CommandRow } from '@/hooks/useMonitoring';

const PRESET_COMMANDS = [
  { label: 'Flush DNS',      cmd: 'ipconfig /flushdns', icon: Network   },
  { label: 'Conexões Ativas', cmd: 'netstat -an',       icon: Activity  },
  { label: 'Ver Processos',  cmd: 'tasklist',           icon: Cpu       },
  { label: 'Forçar GPO',     cmd: 'gpupdate /force',    icon: RefreshCw },
  { label: 'Info do Sistema', cmd: 'systeminfo',        icon: Monitor   },
  { label: 'Verificar Disco', cmd: 'chkdsk C:',        icon: HardDrive },
] as const;

function CommandEntry({ cmd, onCopy }: { cmd: CommandRow; onCopy: (text: string) => void }) {
  const hasPending = cmd.status === 'pending' || cmd.status === 'sent';
  return (
    <div className="space-y-1.5 group/cmd">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-green-500/70 pr-0.5">$</span>
        <span className="text-zinc-200 font-bold font-mono flex-1 break-all">{cmd.command}</span>
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <span className="text-[9px] text-zinc-600 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {format(new Date(cmd.created_at), 'HH:mm:ss')}
          </span>
          {cmd.executed_by_name && (
            <span className="text-[9px] text-indigo-400/60 font-mono">{cmd.executed_by_name}</span>
          )}
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase',
            cmd.status === 'completed' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
            cmd.status === 'failed'    ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                                         'border-amber-500/30 text-amber-400 bg-amber-500/10 animate-pulse',
          )}>
            {hasPending ? '⏳ aguardando' : cmd.status}
          </span>
        </div>
      </div>
      {cmd.output && (
        <div className="relative">
          <pre className="text-[10px] text-zinc-400 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/40 whitespace-pre-wrap leading-relaxed shadow-inner max-h-48 overflow-y-auto">
            {cmd.output}
          </pre>
          <Button
            variant="ghost" size="icon"
            className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover/cmd:opacity-100 transition-opacity hover:bg-zinc-700 text-zinc-400"
            onClick={() => onCopy(cmd.output!)}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface Props {
  machineId: string | null;
  hostname: string | undefined;
  isOnline: boolean;
  userId?: string;
  userName?: string;
}

export const RemoteTerminal: React.FC<Props> = ({ machineId, hostname, isOnline, userId, userName }) => {
  const [cmd, setCmd] = useState('');
  const [clearedBefore, setClearedBefore] = useState<string | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const { data: allCommands = [], isLoading } = useMachineCommands(machineId);
  const createCommand = useCreateCommand();

  const commands = clearedBefore
    ? allCommands.filter(c => c.created_at > clearedBefore)
    : allCommands;

  const hasPending = commands.some(c => c.status === 'pending' || c.status === 'sent');

  // Auto-scroll on new commands
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commands.length]);

  const handleRunCommand = async (customCmd?: string) => {
    const commandToRun = customCmd ?? cmd;
    if (!commandToRun.trim() || !machineId) return;
    if (hasPending) {
      toast.warning('Aguarde o comando anterior completar antes de enviar outro.');
      return;
    }
    try {
      await createCommand.mutateAsync({
        machineId,
        command: commandToRun,
        executed_by_user_id: userId,
        executed_by_name: userName ?? 'Técnico',
      });
      setCmd('');
      toast.success('Comando enfileirado com sucesso!');
    } catch (err: any) {
      toast.error(`Falha ao enviar comando: ${err.message}`);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Output copiado!');
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-xl', isOnline ? 'bg-green-500/10' : 'bg-red-500/10')}>
          <Terminal className={cn('w-5 h-5', isOnline ? 'text-green-600' : 'text-red-500')} />
        </div>
        <div>
          <h4 className="font-bold text-sm">Terminal Remoto</h4>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
            {isOnline ? 'Agente conectado — pronto para receber comandos' : 'Agente offline — comandos ficam na fila'}
          </p>
        </div>
      </div>

      {/* Preset commands */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-0.5">Comandos Rápidos</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_COMMANDS.map(({ label, cmd: presetCmd, icon: Icon }) => (
            <Button
              key={label}
              variant="outline" size="sm"
              className="justify-start gap-2 h-10 text-[11px] font-semibold border-border/40 bg-muted/5 transition-all hover:border-primary/40 hover:bg-primary/5"
              onClick={() => handleRunCommand(presetCmd)}
              disabled={createCommand.isPending || hasPending}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom command input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ex: ping 8.8.8.8 ou ipconfig /all"
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRunCommand()}
          disabled={hasPending}
          className="bg-muted/20 border-border/40 font-mono text-xs"
        />
        <Button
          className="font-bold gap-2 px-5"
          onClick={() => handleRunCommand()}
          disabled={createCommand.isPending || !cmd.trim() || hasPending}
        >
          {hasPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {hasPending ? 'Aguardando...' : 'Rodar'}
        </Button>
      </div>

      <Separator className="border-border/20" />

      {/* Console output */}
      <div className="bg-[#0d0d0f] rounded-xl font-mono text-[11px] overflow-hidden flex flex-col border border-zinc-800/80 shadow-2xl">
        {/* Terminal chrome bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-900 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 hover:bg-red-500 transition-colors cursor-pointer" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 hover:bg-yellow-500 transition-colors cursor-pointer" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 hover:bg-green-500 transition-colors cursor-pointer" />
            </div>
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
              {hostname ?? 'Console'} — Orion Shell
            </span>
          </div>
          <button
            onClick={() => setClearedBefore(new Date().toISOString())}
            className="flex items-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" /> Limpar
          </button>
        </div>

        {/* Output area */}
        <div className="flex-1 overflow-y-auto max-h-[360px] p-4 space-y-4 custom-scrollbar">
          {isLoading ? (
            <div className="text-zinc-600 animate-pulse text-center py-8">Sincronizando logs...</div>
          ) : commands.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-zinc-600 italic text-[10px]"># Terminal pronto. Aguardando entrada...</p>
              <p className="text-zinc-700 text-[9px]">Digite um comando acima ou use os atalhos rápidos.</p>
            </div>
          ) : (
            commands.map(c => <CommandEntry key={c.id} cmd={c} onCopy={handleCopy} />)
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </section>
  );
};
