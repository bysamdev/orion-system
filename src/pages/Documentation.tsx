import React from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, Terminal, Shield, Zap, Search, 
  ChevronRight, Download, Server, Cpu, Globe, 
  Settings, ArrowRight, Sparkles, Code
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Documentation() {
  const sections = [
    {
      id: 'get-started',
      icon: Zap,
      title: 'Início Rápido',
      description: 'Como instalar, configurar e auto-registrar o Orion Agent via GPO.',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    {
      id: 'identification',
      icon: Shield,
      title: 'Identidade Digital',
      description: 'Geração de machine token único baseado em hardware e auto-login.',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    },
    {
      id: 'monitoring',
      icon: Monitor,
      title: 'Monitoramento',
      description: 'Entenda os parâmetros de CPU, Memória, Disco e Rede capturados.',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      id: 'api',
      icon: Code,
      title: 'API & Integrações',
      description: 'Endpoints de heartbeat, poll de comandos e integração de tickets.',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    }
  ];

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10">
      <TopBar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 space-y-8 shrink-0">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-4">Documentação</h3>
              <nav className="space-y-1">
                {sections.map(section => (
                  <button
                    key={section.id}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all group"
                  >
                    <section.icon className={cn("w-4 h-4", section.color)} />
                    {section.title}
                    <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150" />
              <h4 className="text-sm font-black text-foreground mb-2 relative z-10">Precisa de Ajuda?</h4>
              <p className="text-xs text-muted-foreground mb-4 relative z-10">Nossa equipe está disponível para suporte avançado.</p>
              <Button size="sm" className="w-full rounded-xl relative z-10">Abrir Ticket</Button>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-12">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Guia do Administrador</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-foreground leading-[1.1]">
                Documentação <span className="text-primary underline decoration-primary/20">Manual</span> do Orion Agent
              </h1>
              <p className="text-xl text-muted-foreground font-medium max-w-3xl leading-relaxed">
                Aprenda a maximizar o potencial da sua infraestrutura com monitoramento inteligente, 
                automação de tickets e gestão de ativos em tempo real.
              </p>
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map(section => (
                <Card key={section.id} className="group overflow-hidden border border-border/40 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 rounded-[32px] bg-card/50 backdrop-blur-md">
                  <CardContent className="p-8">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3", section.bg)}>
                      <section.icon className={cn("w-7 h-7", section.color)} />
                    </div>
                    <h3 className="text-2xl font-black mb-3 text-foreground group-hover:text-primary transition-colors">{section.title}</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed mb-6">
                      {section.description}
                    </p>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                      Ver detalhes <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Technical Detail Section Example */}
            <div className="space-y-8 bg-muted/20 rounded-[40px] p-8 md:p-12 border border-border/40">
              <div className="flex items-center gap-3 mb-4">
                <Terminal className="w-6 h-6 text-primary" />
                <h2 className="text-3xl font-black tracking-tight">Instalação via Terminal</h2>
              </div>
              
              <p className="text-muted-foreground text-lg leading-relaxed">
                Para ambientes Windows Server ou Linux, recomendamos a instalação via script automatizado 
                para garantir que todas as dependências sejam configuradas corretamente.
              </p>

              <div className="bg-slate-950 rounded-3xl p-6 overflow-hidden relative group">
                <div className="absolute top-4 right-4 flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/40" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/40" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/40" />
                </div>
                <pre className="text-slate-300 font-mono text-sm leading-loose">
                  <code>{`# Baixar o script de instalação
curl -sSL https://get.orion-agent.io | bash

# Configurar chave da empresa
orion-agent config set api_key="YOUR_COMPANY_TOKEN"

# Iniciar serviço em background
sudo systemctl enable --now orion-agent`}</code>
                </pre>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
                <div className="p-6 rounded-2xl bg-background border border-border/40 space-y-2">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Windows</div>
                  <div className="font-bold flex items-center justify-between">
                    v2.4.1 <Download className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-background border border-border/40 space-y-2">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Linux x64</div>
                  <div className="font-bold flex items-center justify-between">
                    v2.4.1 <Download className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-background border border-border/40 space-y-2">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">macOS (ARM)</div>
                  <div className="font-bold flex items-center justify-between">
                    v2.4.1 <Download className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Para evitar erro de import do Monitor que mudei para sections mas esqueci de importar explicitamente se nao estivesse no array.
// Na verdade usei icon: Zap, Shield, Zap, etc. O section.icon cuida disso.
// Importei Monitor na vdd mas nao usei no array acima como componente de icone (usei icon: Monitor mas esqueci de importar)
import { Monitor } from 'lucide-react';
