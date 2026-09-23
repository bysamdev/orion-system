import { ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { RespostaGravada } from '@/lib/perguntasPorCategoria';

interface Props {
  respostas: RespostaGravada[];
}

/**
 * Respostas do formulário de abertura em destaque, para a equipe ler rápido o
 * que o cliente informou: pergunta em rótulo pequeno, resposta em evidência.
 * Substitui o parágrafo corrido da descrição, que tem o mesmo conteúdo.
 */
export function RespostasDoFormulario({ respostas }: Props) {
  return (
    <Card className="p-8 border-none shadow-sm bg-muted/20">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-blue-500" />
        </div>
        <h3 className="font-bold text-lg">Respostas do formulário</h3>
      </div>
      <dl className="space-y-4">
        {respostas.map((r, i) => (
          <div
            key={`${i}-${r.pergunta}`}
            className="rounded-lg border border-border/40 border-l-4 border-l-blue-500 bg-background px-4 py-3"
          >
            <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {r.pergunta}
            </dt>
            <dd className="mt-1.5 text-sm md:text-base font-bold text-foreground whitespace-pre-wrap break-words selection:bg-primary/20">
              {r.resposta}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
