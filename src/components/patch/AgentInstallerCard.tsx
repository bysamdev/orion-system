import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Cpu, Loader2, Terminal, Copy, Check, Package2 } from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { baixarInstaladorDoAgente, baixarInstaladorMsi } from '@/hooks/useAgentInstaller';
import { useToast } from '@/hooks/use-toast';

/**
 * Card de geração do instalador do Orion Agent — já sai configurado com a
 * agent_key da empresa escolhida, sem precisar editar agent.yaml à mão em
 * cada máquina. Fica no topo de Instaladores & Updates de propósito: é o
 * ponto de partida antes de qualquer pacote/script (o agente precisa estar
 * instalado pra receber os dois).
 *
 * O .msi é um build genérico único (não um por empresa, ao contrário do
 * .exe) — a personalização vai via propriedades do msiexec (AGENTKEY etc.),
 * o jeito padrão de GPO Software Installation/SCCM/Intune parametrizarem
 * por grupo/OU. Por isso baixar o .msi também mostra o comando pronto pra
 * colar num Script de Inicialização do GPO.
 */
export const AgentInstallerCard: React.FC = () => {
  const { toast } = useToast();
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const [companyId, setCompanyId] = useState<string>('');
  const [baixando, setBaixando] = useState(false);
  const [baixandoMsi, setBaixandoMsi] = useState(false);
  const [comandoMsi, setComandoMsi] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

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

  const handleBaixarMsi = async () => {
    if (!companyId) return;
    setBaixandoMsi(true);
    try {
      const comando = await baixarInstaladorMsi(companyId);
      setComandoMsi(comando);
    } catch (err) {
      toast({
        title: 'Erro ao gerar o .msi',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setBaixandoMsi(false);
    }
  };

  const handleCopiarComando = () => {
    if (!comandoMsi) return;
    navigator.clipboard.writeText(comandoMsi);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
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
                O <span className="font-semibold text-foreground">.exe</span> já sai configurado com a chave do
                cliente escolhido. O <span className="font-semibold text-foreground">.msi</span> é um build único
                pra qualquer empresa — a chave entra via comando do msiexec, pra deploy por GPO/SCCM/Intune.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0">
            <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setComandoMsi(null); }} disabled={companiesLoading}>
              <SelectTrigger className="w-full lg:w-56 h-10 text-sm font-semibold">
                <SelectValue placeholder={companiesLoading ? 'Carregando...' : 'Escolha o cliente'} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <ButtonPrimary
                onClick={handleBaixar}
                disabled={!companyId || baixando}
                className="gap-2 font-bold whitespace-nowrap"
                icon={baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              >
                {baixando ? 'Gerando...' : 'Baixar .exe'}
              </ButtonPrimary>

              <Button
                variant="outline"
                onClick={handleBaixarMsi}
                disabled={!companyId || baixandoMsi}
                className="gap-2 font-bold whitespace-nowrap h-10"
              >
                {baixandoMsi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package2 className="w-4 h-4" />}
                {baixandoMsi ? 'Gerando...' : 'Baixar .msi'}
              </Button>
            </div>
          </div>
        </div>

        {comandoMsi && (
          <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Comando pra colar no Script de Inicialização do GPO
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-xs font-mono bg-background px-2.5 py-1.5 rounded-lg border border-border/50">
                {comandoMsi}
              </code>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleCopiarComando} aria-label="Copiar comando">
                {copiado ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border/40 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Terminal className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>
            .exe: aponte um Script de Inicialização do GPO pro arquivo baixado com a flag{' '}
            <code className="px-1 py-0.5 rounded bg-muted font-mono">/silent</code>. .msi: use o comando acima
            (msiexec) no mesmo tipo de script, ou cadastre o pacote com esse comando no SCCM/Intune. Os dois já
            rodam elevados e sem esperar nenhuma tecla.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
