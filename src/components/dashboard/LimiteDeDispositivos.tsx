import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ListaDeDispositivos } from '@/components/settings/DispositivosConectados';
import { useSessoes, useVigiaDeSessao } from '@/hooks/useSessoes';
import { LIMITE_DE_DISPOSITIVOS } from '@/lib/sessoes';

/**
 * Trava o uso quando a conta passa de 2 dispositivos: a janela não fecha até a
 * pessoa encerrar os acessos a mais. Também vigia se este acesso foi
 * encerrado em outro aparelho.
 */
export const LimiteDeDispositivos: React.FC = () => {
  useVigiaDeSessao();
  const { sessoes, excesso, encerrar, encerrando } = useSessoes();

  if (excesso === 0) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-lg [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Limite de {LIMITE_DE_DISPOSITIVOS} dispositivos atingido</DialogTitle>
          <DialogDescription>
            Sua conta está conectada em {sessoes.length} dispositivos. Encerre {excesso === 1 ? 'um acesso' : `${excesso} acessos`} para
            continuar usando o Orion aqui.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <ListaDeDispositivos sessoes={sessoes} encerrando={encerrando ?? null} onEncerrar={encerrar} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LimiteDeDispositivos;
