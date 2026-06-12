import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, Terminal, Shield, Zap, Search, 
  ChevronRight, Download, Server, Cpu, Globe, 
  Settings, ArrowRight, Sparkles, Code, Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate, useNavigate } from 'react-router-dom';

export default function Documentation() {
  const navigate = useNavigate();
  const { data: role, isLoading } = useUserRole();

  if (isLoading) return null;
  if (role === 'customer') {
    return <Navigate to="/tutorial" replace />;
  }

  const sections = [
    {
      id: 'get-started',
      icon: Zap,
      title: 'Implantação Assistida',
      description: 'Guia definitivo de instalação do Orion Agent via PowerShell ou GPO/MSI em massa.',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    {
      id: 'identification',
      icon: Shield,
      title: 'Machine-Auth',
      description: 'Como funciona o Machine Token único para login automático sem necessidade de senhas.',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    },
    {
      id: 'monitoring',
      icon: Monitor,
      title: 'Telemetria Real-time',
      description: 'Métricas de CPU, RAM e Disco capturadas a cada ciclo de heartbeat do agente.',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      id: 'commands',
      icon: Terminal,
      title: 'Terminal Remoto',
      description: 'Execução segura de comandos administrativos e scripts via portal de gerenciamento.',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    }
  ];

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 space-y-8 shrink-0">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-4">Centro de Suporte</h3>
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
              <h4 className="text-sm font-black text-foreground mb-2 relative z-10">Dúvidas Técnicas?</h4>
              <p className="text-xs text-muted-foreground mb-4 relative z-10">Tire suas dúvidas diretamente com nossos desenvolvedores.</p>
              <Button size="sm" className="w-full rounded-xl relative z-10 shadow-lg shadow-primary/20">Acessar Wiki</Button>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Infraestrutura Orion</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter text-foreground leading-[0.9]">
                Governança <span className="text-primary tracking-[-0.05em]">Digital</span> de Ativos
              </h1>
              <p className="text-xl text-muted-foreground font-medium max-w-3xl leading-relaxed">
                Bem-vindo ao manual oficial do Orion Agent. Aqui você encontrará tudo o que precisa para gerenciar 
                identidade de máquinas, comandos remotos e telemetria de hardware proativa.
              </p>
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map(section => (
                <Card key={section.id} className="group overflow-hidden border border-border/40 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 rounded-[32px] bg-card/50 backdrop-blur-md relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                  <CardContent className="p-8 relative z-10">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3", section.bg)}>
                      <section.icon className={cn("w-7 h-7", section.color)} />
                    </div>
                    <h3 className="text-2xl font-black mb-3 text-foreground group-hover:text-primary transition-colors tracking-tight">{section.title}</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed mb-6 h-12">
                      {section.description}
                    </p>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                      Ver guia técnico <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Technical Detail Section Example */}
            <div className="space-y-8 bg-muted/20 rounded-[40px] p-8 md:p-12 border border-border/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              
              <div className="flex items-center gap-3 mb-4">
                <Terminal className="w-8 h-8 text-primary" />
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight">Deploy em Ambiente Windows</h2>
              </div>
              
              <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl font-medium">
                O Orion Agent é um binário nativo de alta performance que deve ser executado como serviço do sistema para garantir coleta 24/7.
              </p>

              <div className="bg-slate-950 rounded-3xl p-8 overflow-hidden relative group shadow-2xl">
                <div className="absolute top-4 right-4 flex gap-1.5 z-20">
                  <div className="w-3 h-3 rounded-full bg-red-500/30" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/30" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/30" />
                </div>
                <pre className="text-slate-300 font-mono text-sm leading-relaxed relative z-10">
                  <code className="block">
                    <span className="text-emerald-400"># Instalar o Orion Agent como Serviço</span>{`
.\\orion-agent.exe install

`}<span className="text-emerald-400"># Iniciar o serviço manualmente (opcional, ou via Services.msc)</span>{`
.\\orion-agent.exe start

`}<span className="text-emerald-400"># Configuração Manual de Token (agent.yaml ou ENV)</span>{`
AGENT_URL="https://orion.bysam.dev"
AGENT_KEY="SUA_CHAVE_DE_TENANT"
`}</code>
                </pre>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6">
                <div className="p-8 rounded-[32px] bg-background border border-border/40 space-y-4 group hover:border-primary/30 transition-all">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Download className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Downloads Recentes</div>
                    <div className="font-black text-xl flex items-center justify-between">
                      Windows MSI v1.8.0 <ArrowRight className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                </div>
                <div className="p-8 rounded-[32px] bg-background border border-border/40 space-y-4 group hover:border-primary/30 transition-all">
                   <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Especificações</div>
                    <div className="font-black text-xl flex items-center justify-between">
                      Manual de Comandos <ArrowRight className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100 transition-all" />
                    </div>
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
