import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Terminal, ShieldCheck, Zap, Download, 
  Copy, Check, Info, Server, Plus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserRole';

export const MonitoringOnboarding: React.FC = () => {
  const { data: profile } = useUserProfile();
  const [copied, setCopied] = useState(false);

  const { data: apiKey } = useQuery({
    queryKey: ['my-api-key', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await (supabase
        .from('api_keys' as any) as any)
        .select('key_value')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return (data as any)?.key_value || null;
    },
    enabled: !!profile?.company_id
  });

  const displayKey = apiKey || 'SUA_CHAVE_API_AQUI';
  const command = `curl -sSL https://get.orion-system.io/install.sh | bash -s -- --key ${displayKey}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-2">
          <Server className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-black tracking-tight">Comece a Monitorar suas Máquinas</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          O Orion Agent permite monitorar CPU, Memória, Disco e Status de rede em tempo real. 
          Instale o agente leve em seus servidores Linux ou Windows para começar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard 
          icon={Zap} 
          title="Tempo Real" 
          description="Métricas atualizadas a cada poucos segundos sem recarregar a página." 
        />
        <FeatureCard 
          icon={ShieldCheck} 
          title="Segurança" 
          description="Comunicação criptografada e autenticação por chave de API única." 
        />
        <FeatureCard 
          icon={Terminal} 
          title="Fácil Instalação" 
          description="Script de uma linha para Linux ou executável simples para Windows." 
        />
      </div>

      <div className="bg-card border border-border/40 rounded-3xl overflow-hidden shadow-xl">
        <Tabs defaultValue="linux" className="w-full">
          <div className="p-6 border-b border-border/40 bg-muted/20 flex items-center justify-between">
            <TabsList className="bg-transparent gap-4">
              <TabsTrigger value="linux" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-xl font-bold uppercase tracking-widest text-[10px]">Linux (Bash)</TabsTrigger>
              <TabsTrigger value="windows" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-xl font-bold uppercase tracking-widest text-[10px]">Windows / GPO</TabsTrigger>
            </TabsList>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCopy}
              className="rounded-xl gap-2 font-bold text-[10px] uppercase tracking-wider"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>

          <TabsContent value="linux" className="mt-0">
            <div className="p-8 bg-slate-950 font-mono text-sm text-emerald-400 overflow-x-auto">
              <p className="opacity-50 mb-2"># Execute este comando como root para configurar o agente</p>
              <code>{command}</code>
            </div>
          </TabsContent>

          <TabsContent value="windows" className="mt-0">
            <div className="p-8 bg-slate-950 font-mono text-xs space-y-4">
              <div className="text-emerald-400">
                <p className="opacity-50 mb-2"># Instalação Manual (PowerShell Admin):</p>
                <code className="block">./orion-agent.exe install</code>
                <code className="block mt-1">Start-Service OrionAgent</code>
              </div>
              <div className="pt-4 border-t border-white/10 text-emerald-400">
                <p className="opacity-50 mb-2"># Implantação via GPO (Active Directory):</p>
                <p className="text-muted-foreground mb-2">1. Coloque o executável e o agent.yaml em um share da rede.</p>
                <p className="text-muted-foreground mb-2">2. Use o script PowerShell em: <code className="text-emerald-500 underline">orion-agent/deploy/gpo_install.ps1</code></p>
                <p className="text-muted-foreground">3. Adicione-o como Script de Inicialização (Startup Script) na GPO.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Button size="lg" className="rounded-2xl px-8 gap-2 font-black uppercase tracking-widest shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5" /> Adicionar Máquina Manualmente
        </Button>
        <Button variant="outline" size="lg" className="rounded-2xl px-8 gap-2 font-black uppercase tracking-widest border-border/40">
          <Download className="w-5 h-5" /> Baixar Agente Windows
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 text-muted-foreground p-4 bg-muted/10 rounded-2xl border border-dashed border-border/40">
        <Info className="w-4 h-4 text-primary" />
        <p className="text-xs font-medium italic">
          Precisa de ajuda com a instalação? <button className="underline hover:text-primary transition-colors">Ver documentação técnica</button>
        </p>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, description }: any) => (
  <div className="p-6 bg-card border border-border/40 rounded-2xl space-y-3 hover:border-primary/50 transition-colors group">
    <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10 w-fit group-hover:bg-primary/10 transition-colors">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <h3 className="font-bold text-foreground">{title}</h3>
    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
  </div>
);
