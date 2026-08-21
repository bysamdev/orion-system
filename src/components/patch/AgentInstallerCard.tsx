import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Download, Cpu, Loader2, Terminal, Copy, Check, 
  Package, Sparkles, Building2, HelpCircle, ChevronDown, ChevronUp,
  ShieldCheck, ArrowRight
} from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { baixarInstaladorDoAgente, baixarInstaladorMsi } from '@/hooks/useAgentInstaller';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const AgentInstallerCard: React.FC = () => {
  const { toast } = useToast();
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const [companyId, setCompanyId] = useState<string>('');
  const [baixando, setBaixando] = useState(false);
  const [baixandoMsi, setBaixandoMsi] = useState(false);
  const [comandoMsi, setComandoMsi] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [copiadoSilent, setCopiadoSilent] = useState(false);
  const [showDeployGuide, setShowDeployGuide] = useState(false);

  const selectedCompany = companies.find((c) => c.id === companyId);

  const handleBaixar = async () => {
    if (!companyId) {
      toast({
        title: 'Selecione um cliente',
        description: 'Escolha a empresa para vincular o instalador antes de baixar.',
        variant: 'destructive',
      });
      return;
    }
    setBaixando(true);
    try {
      await baixarInstaladorDoAgente(companyId);
      toast({
        title: 'Download iniciado',
        description: `Instalador configurado para ${selectedCompany?.name || 'o cliente'}.`,
      });
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
    if (!companyId) {
      toast({
        title: 'Selecione um cliente',
        description: 'Escolha a empresa para gerar os parâmetros do pacote MSI.',
        variant: 'destructive',
      });
      return;
    }
    setBaixandoMsi(true);
    try {
      const comando = await baixarInstaladorMsi(companyId);
      setComandoMsi(comando);
      toast({
        title: 'Pacote MSI pronto',
        description: 'O download foi iniciado e o comando de deploy foi gerado.',
      });
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

  const handleCopiarComando = (texto: string, isSilentFlag = false) => {
    navigator.clipboard.writeText(texto);
    if (isSilentFlag) {
      setCopiadoSilent(true);
      setTimeout(() => setCopiadoSilent(false), 2000);
    } else {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
    toast({
      title: 'Copiado para a área de transferência',
      description: 'Comando pronto para uso em scripts ou terminal.',
    });
  };

  return (
    <Card className="mb-8 border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.02] shadow-sm rounded-2xl overflow-hidden transition-all">
      <CardContent className="p-6 sm:p-7 space-y-6">
        {/* Topo do Card: Identificação e Contexto */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Gerador do Orion Agent</h2>
                <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
                  Agente RMM
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crie instaladores vinculados automaticamente à empresa para monitoramento de estações e servidores.
              </p>
            </div>
          </div>

          {/* Seleção do Cliente */}
          <div className="w-full md:w-72 shrink-0">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              1. Selecione o Cliente
            </label>
            <Select
              value={companyId}
              onValueChange={(v) => {
                setCompanyId(v);
                setComandoMsi(null);
              }}
              disabled={companiesLoading}
            >
              <SelectTrigger className="w-full h-10 rounded-xl font-medium border-border/70 bg-background shadow-xs focus:ring-2 focus:ring-primary/20 transition-all">
                <SelectValue placeholder={companiesLoading ? 'Carregando empresas...' : 'Escolha a empresa...'} />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl">
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="cursor-pointer font-medium">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Opções de Download: 2 Formatos Claros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Opção 1: Executável Direto (.exe) */}
          <div className={cn(
            "group relative p-4.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between",
            companyId 
              ? "bg-muted/20 hover:bg-muted/30 border-border/70 hover:border-primary/40 shadow-xs" 
              : "bg-muted/10 border-border/40 opacity-70"
          )}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-background border border-border/60 text-primary">
                    <Download className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-foreground">Instalador Direto (.EXE)</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-medium">
                  Manual / Técnico
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Recomendado para instalação rápida em máquinas pontuais. Já vem assinado e configurado com as credenciais do cliente.
              </p>
            </div>

            <div className="pt-4 mt-2 flex items-center justify-between border-t border-border/30">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Sem configuração manual
              </span>
              <Button
                size="sm"
                onClick={handleBaixar}
                disabled={!companyId || baixando}
                className="h-9 px-4 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1.5 transition-all"
              >
                {baixando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Baixar .EXE
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Opção 2: Pacote Corporativo (.msi) */}
          <div className={cn(
            "group relative p-4.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between",
            companyId 
              ? "bg-muted/20 hover:bg-muted/30 border-border/70 hover:border-primary/40 shadow-xs" 
              : "bg-muted/10 border-border/40 opacity-70"
          )}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-background border border-border/60 text-primary">
                    <Package className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-foreground">Pacote em Massa (.MSI)</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-medium">
                  GPO / Intune / SCCM
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ideal para distribuição automatizada em todo o domínio Active Directory ou gerenciadores de dispositivos.
              </p>
            </div>

            <div className="pt-4 mt-2 flex items-center justify-between border-t border-border/30">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-blue-500" />
                Gera comando pronto
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBaixarMsi}
                disabled={!companyId || baixandoMsi}
                className="h-9 px-4 rounded-xl font-bold border-border/60 hover:bg-accent gap-1.5 transition-all"
              >
                {baixandoMsi ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Package className="w-3.5 h-3.5" />
                    Baixar .MSI
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Comando MSI gerado dinamicamente */}
        {comandoMsi && (
          <div className="p-4 rounded-xl bg-muted/40 border border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Linha de comando para Deploy Silencioso (GPO / Script):
              </span>
              <span className="text-[10px] text-muted-foreground">Executa em segundo plano com elevação</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 font-mono text-xs bg-background p-2.5 rounded-lg border border-border/60 select-all overflow-x-auto text-foreground">
                {comandoMsi}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopiarComando(comandoMsi)}
                className="h-9 px-3 rounded-lg shrink-0 gap-1.5 font-semibold text-xs"
              >
                {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>
        )}

        {/* Guia Rápido de Automação (Colapsável) */}
        <div className="pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => setShowDeployGuide(!showDeployGuide)}
            className="flex items-center justify-between w-full text-left py-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              Como instalar em modo silencioso via script ou linha de comando?
            </span>
            {showDeployGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDeployGuide && (
            <div className="mt-3 p-4 rounded-xl bg-muted/20 border border-border/40 space-y-3 text-xs text-muted-foreground animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>Instalação Silenciosa (.EXE)</span>
                    <button
                      onClick={() => handleCopiarComando('OrionAgentSetup.exe /silent', true)}
                      className="text-[10px] text-primary hover:underline font-mono cursor-pointer"
                    >
                      {copiadoSilent ? 'Copiado!' : 'Copiar flag'}
                    </button>
                  </div>
                  <code className="block bg-background px-2.5 py-1.5 rounded-lg border border-border/40 font-mono text-[11px]">
                    OrionAgentSetup.exe /silent
                  </code>
                  <p className="text-[11px] text-muted-foreground">
                    Pode ser colocado diretamente no Script de Inicialização da máquina no GPO.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-foreground">
                    Deploy Corporativo (.MSI)
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Baixe o <strong>.msi</strong> selecionando a empresa desejada acima. O Orion System vai gerar a linha de comando exata com a <code>AGENTKEY</code> correspondente pronta para colar na sua GPO ou no Intune.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

