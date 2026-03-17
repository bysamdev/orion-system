import React from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, Ticket, ShieldCheck, Heart, 
  MousePointer2, HelpCircle, Monitor,
  ExternalLink, ChevronRight, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UserGuide = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: "Como abrir um chamado",
      icon: Ticket,
      color: "text-primary",
      bg: "bg-primary/10",
      content: "Clique no botão '+ Novo Ticket' no topo da página. Siga o assistente de 3 passos: selecione a categoria, descreva o problema e anexe fotos se necessário. Nosso time será notificado instantaneamente."
    },
    {
      title: "Suporte Remoto (AnyDesk)",
      icon: Monitor,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      content: "Caso precisemos acessar seu computador, pediremos seu ID do AnyDesk. Você o encontra abrindo o aplicativo AnyDesk na sua máquina — é o número de 9 dígitos exibido em 'Este Dispositivo'."
    },
    {
      title: "Acompanhamento",
      icon: BookOpen,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      content: "Você receberá notificações por e-mail e no portal sobre cada atualização do seu chamado. Você pode responder diretamente pelo portal para agilizar o atendimento."
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      
      <main className="flex-1 p-6 lg:p-12 max-w-5xl mx-auto w-full space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-full">
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Portal do Usuário</span>
          </div>
        </div>

        <div className="space-y-4 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-foreground">Guia de Uso Orion</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Aprenda como utilizar nossa plataforma para obter suporte técnico rápido e eficiente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sections.map((section, idx) => (
            <Card key={idx} className="border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all group">
              <CardContent className="p-8 space-y-6">
                <div className={`w-12 h-12 rounded-2xl ${section.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <section.icon className={`w-6 h-6 ${section.color}`} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold">{section.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Section: AnyDesk Tutorial */}
        <section className="bg-primary/5 border border-primary/10 rounded-[32px] p-8 lg:p-12 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32 transition-opacity group-hover:opacity-100 opacity-50" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Tutorial Detalhado</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight">Como funciona o Suporte Remoto?</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para resolver problemas complexos, nosso técnico pode solicitar acesso remoto à sua estação de trabalho. Utilizamos o <strong>AnyDesk</strong> pela sua segurança e velocidade.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  "Abra o AnyDesk (ícone vermelho na sua área de trabalho)",
                  "Localize o campo 'Este Dispositivo' no canto superior esquerdo",
                  " Informe o código de 9 dígitos ao técnico responsável",
                  "Clique em 'Aceitar' quando o pop-up de conexão aparecer"
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black shrink-0 mt-1">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium text-foreground">{step}</p>
                  </div>
                ))}
              </div>

              <Button onClick={() => navigate('/novo-ticket')} className="h-12 px-8 rounded-xl font-bold gap-2">
                Abrir um chamado agora <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="hidden lg:block">
               {/* Visual representaton of AnyDesk ID */}
               <div className="bg-background/80 backdrop-blur-xl border border-border/40 rounded-3xl p-8 shadow-2xl space-y-6 max-w-sm mx-auto transform hover:-rotate-2 transition-transform cursor-default">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-red-500 rounded-lg" />
                     <span className="font-bold text-sm">AnyDesk</span>
                   </div>
                   <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                 </div>
                 
                 <div className="space-y-2 py-4 border-y border-border/20">
                   <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Este Dispositivo</p>
                   <p className="text-3xl font-black text-foreground tracking-widest">392 108 554</p>
                 </div>
                 
                 <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground italic">
                   <span>Pronto para conexões</span>
                   <ExternalLink className="w-3 h-3" />
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* Need help? */}
        <div className="text-center space-y-6 pb-12">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            <h3 className="text-xl font-bold">Ainda com dúvidas?</h3>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Nossa base de conhecimento possui centenas de guias rápidos para problemas comuns do dia a dia.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button variant="outline" className="h-12 px-8 rounded-xl font-bold" onClick={() => navigate('/knowledge')}>
              Explorar Base de Conhecimento
            </Button>
            <Button variant="ghost" className="h-12 px-8 rounded-xl font-bold gap-2">
              <HelpCircle className="w-5 h-5" /> Help Center
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserGuide;
