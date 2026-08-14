import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/lib/useErrorHandler';
import { fetchWithTimeout } from '@/lib/fetch-client';
import {
  Ripple,
  AuthTabs,
  TechOrbitDisplay,
  OrbitIconConfig,
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
import { Sparkles, Star, ShieldCheck, Orbit, Compass, Loader2 } from 'lucide-react';

import orionLogo from '@/assets/orion-logo.png';
import orionLogoLight from '@/assets/orion-logo-light.png';

// Constelação de Orion orbitando a marca central
const orbitIcons: OrbitIconConfig[] = [
  {
    component: () => (
      <div className="flex items-center justify-center size-9 rounded-full bg-purple-500/20 backdrop-blur-md border border-purple-400/40 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]">
        <Star className="size-5 fill-amber-300 stroke-amber-400 animate-pulse" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 18,
    delay: 0,
    radius: 110,
    path: true,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex items-center justify-center size-8 rounded-full bg-purple-600/20 backdrop-blur-md border border-purple-400/30 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.4)]">
        <Sparkles className="size-4 fill-purple-300 stroke-purple-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 24,
    delay: 6,
    radius: 160,
    path: true,
    reverse: true,
  },
  {
    component: () => (
      <div className="flex items-center justify-center size-10 rounded-full bg-indigo-500/20 backdrop-blur-md border border-indigo-400/40 text-indigo-300 shadow-[0_0_18px_rgba(99,102,241,0.4)]">
        <Star className="size-5 fill-indigo-300 stroke-indigo-200" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 30,
    delay: 12,
    radius: 220,
    path: true,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex items-center justify-center size-8 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
        <ShieldCheck className="size-4" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 26,
    delay: 18,
    radius: 270,
    path: true,
    reverse: true,
  },
  {
    component: () => (
      <div className="flex items-center justify-center size-9 rounded-full bg-violet-600/25 backdrop-blur-md border border-violet-400/40 text-violet-200 shadow-[0_0_15px_rgba(139,92,246,0.4)]">
        <Orbit className="size-5" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 35,
    delay: 8,
    radius: 330,
    path: true,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex items-center justify-center size-8 rounded-full bg-purple-500/20 backdrop-blur-md border border-purple-400/30 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.3)]">
        <Compass className="size-4" />
      </div>
    ),
    className: 'border-none bg-transparent',
    duration: 22,
    delay: 15,
    radius: 190,
    path: false,
    reverse: true,
  },
];

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [machineToken, setMachineToken] = useState<string | null>(null);
  const [isDetectingAgent, setIsDetectingAgent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Esqueci a Senha
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

  const handleSignIn = async (e: React.FormEvent) => {
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

  const formFields = {
    header: 'Orion System',
    subHeader: 'Gerenciamento de TI, Ativos & Helpdesk Inteligente',
    fields: [
      {
        label: 'E-mail Corporativo',
        name: 'login-email-unique',
        required: true,
        type: 'email' as const,
        placeholder: 'seu.email@empresa.com',
        value: email,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
      },
      {
        label: 'Senha de Acesso',
        name: 'login-password-field',
        required: true,
        type: 'password' as const,
        placeholder: '••••••••',
        value: password,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
      },
    ],
    submitButton: isSubmitting ? 'Acessando...' : 'Entrar no Sistema',
    isLoading: isSubmitting,
    textVariantButton: 'Esqueceu a senha?',
    extraHeaderContent: (
      <div className="flex items-center gap-2 mb-2 lg:hidden">
        <img
          src={orionLogo}
          alt="Orion System Logo"
          className="h-10 w-auto dark:hidden"
        />
        <img
          src={orionLogoLight}
          alt="Orion System Logo"
          className="h-10 w-auto hidden dark:block"
        />
        <span className="font-semibold text-lg text-purple-950 dark:text-purple-100">
          Orion System
        </span>
      </div>
    ),
  };

  return (
    <main className="min-h-screen w-full bg-background flex max-lg:justify-center overflow-hidden">
      {/* Lado Esquerdo: Logo Central do Orion com Estrelas Orbitando & Ripple */}
      <section className="relative hidden lg:flex flex-col items-center justify-center w-1/2 bg-gradient-to-br from-purple-950/15 via-background to-purple-900/10 dark:from-purple-950/40 dark:via-background dark:to-purple-900/20 border-r border-border/50">
        <Ripple mainCircleSize={120} mainCircleOpacity={0.28} numCircles={9} />

        <TechOrbitDisplay
          iconsArray={orbitIcons}
          text="Bem Vindo(a)"
          centerElement={
            <div className="relative group flex items-center justify-center p-6 rounded-3xl bg-background/60 dark:bg-zinc-950/60 backdrop-blur-xl border border-purple-500/20 shadow-[0_0_35px_rgba(168,85,247,0.15)] transition-transform duration-500 hover:scale-105">
              <img
                src={orionLogo}
                alt="Orion System Logo"
                className="h-28 w-auto dark:hidden drop-shadow-md"
              />
              <img
                src={orionLogoLight}
                alt="Orion System Logo"
                className="h-28 w-auto hidden dark:block drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]"
              />
            </div>
          }
        />
      </section>

      {/* Lado Direito: Formulário com Efeitos de Glow e Validação */}
      <section className="w-full lg:w-1/2 min-h-screen flex flex-col justify-center items-center px-6 sm:px-12 relative z-10">
        <AuthTabs
          formFields={formFields}
          goTo={(e) => {
            e.preventDefault();
            setResetEmail(email);
            setForgotPasswordOpen(true);
          }}
          handleSubmit={handleSignIn}
        />

        {/* Informações de Rodapé */}
        <footer className="absolute bottom-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Orion System. Todos os direitos reservados.
        </footer>
      </section>

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
    </main>
  );
};

export default Auth;
