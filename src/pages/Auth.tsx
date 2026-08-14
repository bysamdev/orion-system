import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/lib/useErrorHandler';
import { fetchWithTimeout } from '@/lib/fetch-client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Ripple,
  TechOrbitDisplay,
  AnimatedForm,
  OrbitIconConfig,
  Field,
} from '@/components/ui/modern-animated-sign-in';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Ticket, 
  Monitor, 
  Laptop, 
  Server as ServerIcon, 
  Wifi, 
  Network, 
  HardDrive, 
  ShieldCheck, 
  Sparkles, 
  Loader2 
} from 'lucide-react';

import orionLogo from '@/assets/orion-logo.png';
import orionLogoLight from '@/assets/orion-logo-light.png';

// Constelação de ícones de TI do sistema orbitando ao redor da logo Orion
const orbitIcons: OrbitIconConfig[] = [
  {
    // Ticket / Chamado
    component: () => (
      <div className="flex items-center justify-center size-9 rounded-full bg-purple-600/25 backdrop-blur-md border border-purple-400/50 text-purple-200 shadow-[0_0_16px_rgba(168,85,247,0.5)]">
        <Ticket className="size-4 text-purple-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 22,
    delay: 15,
    radius: 175,
    path: true,
    reverse: false,
  },
  {
    // Computador / Desktop
    component: () => (
      <div className="flex items-center justify-center size-9 rounded-full bg-blue-500/25 backdrop-blur-md border border-blue-400/40 text-blue-200 shadow-[0_0_14px_rgba(59,130,246,0.4)]">
        <Monitor className="size-4 text-blue-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 22,
    delay: 5,
    radius: 175,
    path: true,
    reverse: false,
  },
  {
    // Notebook / Laptop
    component: () => (
      <div className="flex items-center justify-center size-9 rounded-full bg-cyan-500/25 backdrop-blur-md border border-cyan-400/40 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.4)]">
        <Laptop className="size-4 text-cyan-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 26,
    delay: 20,
    radius: 235,
    path: true,
    reverse: true,
  },
  {
    // Servidor
    component: () => (
      <div className="flex items-center justify-center size-9 rounded-full bg-amber-500/25 backdrop-blur-md border border-amber-400/40 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.45)]">
        <ServerIcon className="size-4 text-amber-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 26,
    delay: 10,
    radius: 235,
    path: true,
    reverse: true,
  },
  {
    // Wi-Fi / Rede Sem Fio
    component: () => (
      <div className="flex items-center justify-center size-10 rounded-full bg-emerald-500/25 backdrop-blur-md border border-emerald-400/40 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.4)]">
        <Wifi className="size-5 text-emerald-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    radius: 295,
    duration: 30,
    path: true,
    reverse: false,
  },
  {
    // Switch / Topologia de Rede
    component: () => (
      <div className="flex items-center justify-center size-10 rounded-full bg-indigo-500/25 backdrop-blur-md border border-indigo-400/40 text-indigo-200 shadow-[0_0_16px_rgba(99,102,241,0.4)]">
        <Network className="size-5 text-indigo-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    radius: 295,
    duration: 30,
    delay: 20,
    path: true,
    reverse: false,
  },
  {
    // Armazenamento / Storage / HD
    component: () => (
      <div className="flex items-center justify-center size-10 rounded-full bg-violet-600/25 backdrop-blur-md border border-violet-400/40 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.4)]">
        <HardDrive className="size-5 text-violet-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    radius: 355,
    duration: 34,
    path: true,
    reverse: true,
  },
  {
    // Segurança / Antivírus / RMM
    component: () => (
      <div className="flex items-center justify-center size-10 rounded-full bg-teal-500/25 backdrop-blur-md border border-teal-400/40 text-teal-200 shadow-[0_0_16px_rgba(20,184,166,0.4)]">
        <ShieldCheck className="size-5 text-teal-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    radius: 355,
    duration: 34,
    delay: 40,
    path: true,
    reverse: true,
  },
];

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const { resolvedTheme } = useTheme();
  const [machineToken, setMachineToken] = useState<string | null>(null);
  const [isDetectingAgent, setIsDetectingAgent] = useState(false);

  // Se o usuário já estiver logado, redireciona para o painel principal
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Recuperação de Senha
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setEmail('');
    setPassword('');
    localStorage.removeItem('lastEmail');
  }, []);

  useEffect(() => {
    const detectAgent = async () => {
      setIsDetectingAgent(true);
      try {
        const response = await fetchWithTimeout('http://127.0.0.1:8081/token', { timeoutMs: 3000 });
        if (response.ok) {
          const data = await response.json();
          setMachineToken(data.machine_token);
          toast({
            title: "Agente Orion Detectado",
            description: "Identificação automática de máquina ativada.",
          });
        }
      } catch (err) {
        // Sem agente local rodando
      } finally {
        setIsDetectingAgent(false);
      }
    };

    detectAgent();
  }, [toast]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Atenção', description: 'Preencha o e-mail e a senha.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      handleError(error, 'Auth.handleLogin', 'Credenciais inválidas. Verifique seu e-mail e senha.');
    } else {
      if (machineToken) {
        localStorage.setItem('orion_machine_token', machineToken);
      }
      navigate('/');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({ title: 'Atenção', description: 'Informe seu e-mail para recuperação.', variant: 'destructive' });
      return;
    }

    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/set-password`,
    });
    setIsResetting(false);

    if (error) {
      toast({
        title: 'Erro ao enviar e-mail',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'E-mail enviado com sucesso!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
      setForgotPasswordOpen(false);
      setResetEmail('');
    }
  };

  const fields: Field[] = [
    {
      label: 'E-mail',
      name: 'login-email-unique',
      required: true,
      type: 'email',
      placeholder: 'seu@email.com',
      value: email,
      onChange: (e) => setEmail(e.target.value),
    },
    {
      label: 'Senha',
      name: 'login-password-field',
      required: true,
      type: 'password',
      placeholder: '••••••••',
      value: password,
      onChange: (e) => setPassword(e.target.value),
    },
  ];

  const isDark = resolvedTheme === 'dark';

  return (
    <section className="flex max-lg:justify-center min-h-screen w-full bg-background relative overflow-hidden transition-colors duration-300">
      {/* Botão de Alternância de Tema no Canto Superior Direito */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <div className="p-1 rounded-full bg-card/80 dark:bg-zinc-900/80 backdrop-blur-md border border-border shadow-sm">
          <ThemeToggle />
        </div>
      </div>

      {/* Lado Esquerdo (50% Desktop): Logo do Orion Centralizada e Limpa, com Órbitas Externas e Ripple */}
      <span className="flex flex-col justify-center items-center w-1/2 max-lg:hidden relative overflow-hidden">
        <Ripple mainCircleSize={200} />
        
        <TechOrbitDisplay
          iconsArray={orbitIcons}
          centerElement={
            <motion.div
              animate={{
                y: [-6, 6, -6],
                rotate: [-2, 2, -2],
                scale: [1, 1.03, 1],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative z-30 flex items-center justify-center select-none"
            >
              {/* Apenas a logo no centro, 100% limpa, sem qualquer ícone ou caixa atrás */}
              <img
                src={isDark ? orionLogoLight : orionLogo}
                alt="Orion System Logo"
                className={`h-32 w-auto object-contain transition-all duration-300 ${
                  isDark
                    ? 'drop-shadow-[0_0_30px_rgba(168,85,247,0.55)]'
                    : 'drop-shadow-[0_4px_20px_rgba(40,1,55,0.15)]'
                }`}
              />
            </motion.div>
          }
        />
      </span>

      {/* Lado Direito (50% Desktop, 100% Mobile): Formulário Animado */}
      <span className="w-1/2 min-h-screen h-screen flex flex-col justify-center items-center max-lg:w-full max-lg:px-[10%] px-6 relative z-10">
        <AnimatedForm
          header="Orion System"
          subHeader="Sistema de Gerenciamento de Chamados & TI"
          fields={fields}
          submitButton={isSubmitting ? "Acessando..." : "Entrar"}
          textVariantButton="Esqueceu a senha?"
          isLoading={isSubmitting}
          onSubmit={handleSignIn}
          goTo={(e) => {
            e.preventDefault();
            setResetEmail(email);
            setForgotPasswordOpen(true);
          }}
          extraHeaderContent={
            <div className="flex items-center gap-3 mb-3 lg:hidden">
              <img
                src={isDark ? orionLogoLight : orionLogo}
                alt="Orion System Logo"
                className="h-10 w-auto object-contain"
              />
              <span className="font-semibold text-xl text-foreground">
                Orion System
              </span>
            </div>
          }
        />

        {/* Rodapé */}
        <footer className="absolute bottom-4 left-0 right-0 text-center text-xs text-muted-foreground/60 pointer-events-none select-none">
          &copy; {new Date().getFullYear()} Orion System. Todos os direitos reservados.
        </footer>
      </span>

      {/* Modal de Recuperação de Senha */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="size-5 text-purple-600 dark:text-purple-400" />
              Recuperar Senha
            </DialogTitle>
            <DialogDescription>
              Informe seu e-mail corporativo cadastrado para receber o link de redefinição de senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail Cadastrado</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="seu.email@empresa.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotPasswordOpen(false)}
                disabled={isResetting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-purple-700 hover:bg-purple-800 text-white"
                disabled={isResetting}
              >
                {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Auth;
