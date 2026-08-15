import { useSystemGraphSocket } from '@/hooks/useSystemGraphSocket';

export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border/40">
        <h1 className="text-lg font-bold">Live System Graph</h1>
        <p className="text-xs text-muted-foreground">
          Conexão: {status === 'open' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'desconectado'}
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Grafo em construção (Task 8+).
      </div>
    </div>
  );
}
