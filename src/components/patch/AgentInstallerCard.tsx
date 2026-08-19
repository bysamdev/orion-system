import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Cpu, Loader2, Terminal } from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { baixarInstaladorDoAgente } from '@/hooks/useAgentInstaller';
import { useToast } from '@/hooks/use-toast';

/**
 * Card de geração do instalador do Orion Agent — já sai configurado com a
 * agent_key da empresa escolhida, sem precisar editar agent.yaml à mão em
 * cada máquina. Fica no topo de Instaladores & Updates de propósito: é o
 * ponto de partida antes de qualquer pacote/script (o agente precisa estar
 * instalado pra receber os dois).
 */
export const AgentInstallerCard: React.FC = () => {
  const { toast } = useToast();
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const [companyId, setCompanyId] = useState<string>('');
  const [baixando, setBaixando] = useState(false);

  const handleBaixar = async () => {
    if (!companyId) return;
    setBaixando(true);
    try {
      await baixarInstaladorDoAgente(companyId);
    } catch (err) {
      toast({
        title: 'Erro ao gerar instalador',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Card className="mb-8 border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 flex-shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-base">Instalador do Orion Agent</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gera um <span className="font-semibold text-foreground">.exe</span> já configurado com a chave do
                cliente escolhido — instala, se registra sozinho e aparece identificado no monitor de ativos, sem
                editar nada à mão.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Select value={companyId} onValueChange={setCompanyId} disabled={companiesLoading}>
              <SelectTrigger className="w-full lg:w-56 h-10 text-sm font-semibold">
                <SelectValue placeholder={companiesLoading ? 'Carregando...' : 'Escolha o cliente'} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ButtonPrimary
              onClick={handleBaixar}
              disabled={!companyId || baixando}
              className="gap-2 font-bold whitespace-nowrap"
              icon={baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            >
              {baixando ? 'Gerando...' : 'Baixar .exe'}
            </ButtonPrimary>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Terminal className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>
            Pra implantar em massa via GPO do AD: aponte um Script de Inicialização pro instalador baixado com a
            flag <code className="px-1 py-0.5 rounded bg-muted font-mono">/silent</code> — ele já roda elevado
            (o script de GPO já executa como SYSTEM) e não espera nenhuma tecla.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
