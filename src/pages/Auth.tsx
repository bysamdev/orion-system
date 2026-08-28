import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
import { Badge } from '@/components/ui/badge';
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
  Loader2,
  Lock,
  KeyRound,
  ArrowLeft,
  Smartphone,
  ShieldAlert
} from 'lucide-react';
import { verifyBackupCode, formatBackupCode } from '@/lib/mfa';

import orionLogo from '@/assets/orion-logo.png';
import orionLogoLight from '@/assets/orion-logo-light.png';

// Constelação de ícones de TI do sistema orbitando ao redor da logo Orion
const orbitIcons: OrbitIconConfig[] = [
  {
    // Ticket / Chamado
    component: () => (
      <div className="flex items-center justify-center size-9 rounded-full bg-primary/10 border border-primary/30 text-primary shadow-[0_2px_10px_hsla(var(--primary),0.2)] dark:bg-primary/20 dark:backdrop-blur-md dark:border-primary/40 dark:text-primary-foreground dark:shadow-[0_0_16px_hsla(var(--primary),0.4)]">
        <Ticket className="size-4 text-primary dark:text-primary stroke-[2.2]" />
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
      <div className="flex items-center justify-center size-9 rounded-full bg-blue-100 border border-blue-300 text-blue-700 shadow-[0_2px_10px_rgba(59,130,246,0.3)] dark:bg-blue-600/30 dark:backdrop-blur-md dark:border-blue-400/60 dark:text-blue-200 dark:shadow-[0_0_16px_rgba(59,130,246,0.45)]">
        <Monitor className="size-4 text-blue-700 dark:text-blue-200 stroke-[2.2]" />
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
      <div className="flex items-center justify-center size-9 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-800 shadow-[0_2px_10px_rgba(6,182,212,0.3)] dark:bg-cyan-600/30 dark:backdrop-blur-md dark:border-cyan-400/60 dark:text-cyan-200 dark:shadow-[0_0_16px_rgba(6,182,212,0.45)]">
        <Laptop className="size-4 text-cyan-800 dark:text-cyan-200 stroke-[2.2]" />
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
      <div className="flex items-center justify-center size-9 rounded-full bg-amber-100 border border-amber-300 text-amber-800 shadow-[0_2px_10px_rgba(245,158,11,0.3)] dark:bg-amber-600/30 dark:backdrop-blur-md dark:border-amber-400/60 dark:text-amber-200 dark:shadow-[0_0_16px_rgba(251,191,36,0.5)]">
        <ServerIcon className="size-4 text-amber-800 dark:text-amber-200 stroke-[2.2]" />
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
      <div className="flex items-center justify-center size-10 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-[0_2px_12px_rgba(16,185,129,0.3)] dark:bg-emerald-600/30 dark:backdrop-blur-md dark:border-emerald-400/60 dark:text-emerald-200 dark:shadow-[0_0_18px_rgba(52,211,153,0.5)]">
        <Wifi className="size-5 text-emerald-800 dark:text-emerald-200 stroke-[2.2]" />
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
      <div className="flex items-center justify-center size-10 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-800 shadow-[0_2px_12px_rgba(99,102,241,0.3)] dark:bg-indigo-600/30 dark:backdrop-blur-md dark:border-indigo-400/60 dark:text-indigo-200 dark:shadow-[0_0_18px_rgba(99,102,241,0.5)]">
        <Network className="size-5 text-indigo-800 dark:text-indigo-200 stroke-[2.2]" />
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
      <div className="flex items-center justify-center size-10 rounded-full bg-violet-100 border border-violet-300 text-violet-800 shadow-[0_2px_12px_rgba(139,92,246,0.3)] dark:bg-violet-600/30 dark:backdrop-blur-md dark:border-violet-400/60 dark:text-violet-200 dark:shadow-[0_0_18px_rgba(139,92,246,0.5)]">
        <HardDrive className="size-5 text-violet-800 dark:text-violet-200 stroke-[2.2]" />
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
      <div className="flex items-center justify-center size-10 rounded-full bg-teal-100 border border-teal-300 text-teal-800 shadow-[0_2px_12px_rgba(20,184,166,0.3)] dark:bg-teal-600/30 dark:backdrop-blur-md dark:border-teal-400/60 dark:text-teal-200 dark:shadow-[0_0_18px_rgba(20,184,166,0.5)]">
        <ShieldCheck className="size-5 text-teal-800 dark:text-teal-200 stroke-[2.2]" />
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Autenticação em Dois Fatores (2FA)
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);

  // Modal de Recuperação de Senha
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Redirecionamento condicional ao carregar
  useEffect(() => {
    const checkAssuranceAndRedirect = async () => {
      if (!authLoading && user) {
        try {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
            const hasBackupBypass = sessionStorage.getItem('orion_mfa_backup_passed') === 'true';
            if (!hasBackupBypass) {
              // Exige desafio 2FA
              const { data: factors } = await supabase.auth.mfa.listFactors();
              const totp = factors?.totp?.find((f) => f.status === 'verified');
              if (totp) {
                setMfaFactorId(totp.id);
                setMfaRequired(true);
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[Auth] Erro ao verificar AAL na inicialização:', err);
        }

        // Sem MFA pendente -> segue para o dashboard
        navigate('/', { replace: true });
      }
    };

    checkAssuranceAndRedirect();
  }, [user, authLoading, navigate]);

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

  // Submissão inicial de Email e Senha
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

    if (error) {
      setIsSubmitting(false);
      handleError(error, 'Auth.handleLogin', 'Credenciais inválidas. Verifique seu e-mail e senha.');
      return;
    }

    // Verificar se o usuário possui 2FA ativado (AAL2 requerido)
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === 'verified');
        
        if (totp) {
          setMfaFactorId(totp.id);
          setMfaRequired(true);
          setTotpCode('');
          setBackupCode('');
          setIsBackupMode(false);
          setIsSubmitting(false);
          return;
        }
      }
    } catch (mfaCheckError) {
      console.warn('[Auth] Erro ao checar fatores MFA após login:', mfaCheckError);
    }

    setIsSubmitting(false);

    // Login sem 2FA (usuários existentes ou sem MFA configurado)
    if (machineToken) {
      localStorage.setItem('orion_machine_token', machineToken);
    }
    navigate('/');
  };

  // Verificação do Código TOTP (6 dígitos)
  const handleVerifyMfaTotp = useCallback(async (codeToVerify?: string) => {
    const code = (codeToVerify || totpCode).trim().replace(/\s+/g, '');
    if (!mfaFactorId || code.length !== 6 || isMfaSubmitting) return;

    setIsMfaSubmitting(true);
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code,
      });

      if (error) throw error;

      toast({
        title: "Autenticado com Sucesso!",
        description: "Autenticação em dois fatores verificada.",
      });

      if (machineToken) {
        localStorage.setItem('orion_machine_token', machineToken);
      }
      sessionStorage.removeItem('orion_mfa_backup_passed');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast({
        title: "Código 2FA Inválido",
        description: "O código digitado está incorreto ou expirou. Tente novamente.",
        variant: "destructive",
      });
      setTotpCode('');
    } finally {
      setIsMfaSubmitting(false);
    }
  }, [mfaFactorId, totpCode, isMfaSubmitting, machineToken, navigate, toast]);

  // Submissão do formulário TOTP
  const handleTotpFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerifyMfaTotp();
  };

  // Verificação de Código de Recuperação / Backup
  const handleVerifyBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = backupCode.trim();
    if (!clean || isMfaSubmitting) return;

    setIsMfaSubmitting(true);
    try {
      const isValid = await verifyBackupCode(clean);
      if (!isValid) {
        throw new Error('Código de recuperação inválido ou já utilizado.');
      }

      sessionStorage.setItem('orion_mfa_backup_passed', 'true');

      toast({
        title: "Acesso Autorizado via Backup!",
        description: "Código de recuperação validado e consumido. Lembre-se de gerar novos códigos em Configurações > Segurança.",
      });

      if (machineToken) {
        localStorage.setItem('orion_machine_token', machineToken);
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      toast({
        title: "Código Inválido",
        description: err.message || "Não foi possível validar o código de recuperação.",
        variant: "destructive",
      });
    } finally {
      setIsMfaSubmitting(false);
    }
  };

  // Cancelar desafio 2FA e deslogar
  const handleCancelMfa = async () => {
    await supabase.auth.signOut();
    setMfaRequired(false);
    setTotpCode('');
    setBackupCode('');
    setIsBackupMode(false);
    sessionStorage.removeItem('orion_mfa_backup_passed');
  };

  // Recuperação de senha
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

      {/* Lado Direito (50% Desktop, 100% Mobile): Formulário Principal ou Desafio 2FA */}
      <span className="w-1/2 min-h-screen h-screen flex flex-col justify-center items-center max-lg:w-full max-lg:px-[10%] px-6 relative z-10">
        <AnimatePresence mode="wait">
          {!mfaRequired ? (
            /* Formulário Normal de Login */
            <motion.div
              key="login-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md"
            >
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
            </motion.div>
          ) : (
            /* Painel de Desafio 2FA (TOTP / Códigos de Backup) */
            <motion.div
              key="mfa-challenge"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md p-6 sm:p-8 rounded-xl border border-border bg-card/90 backdrop-blur-xl shadow-2xl space-y-6"
            >
              {/* Cabeçalho do 2FA */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-1 ring-8 ring-primary/5">
                  <Lock className="h-6 w-6" />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline" className="text-[11px] border-primary/30 text-primary font-medium">
                    Autenticação em Duas Etapas
                  </Badge>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {isBackupMode ? "Código de Recuperação" : "Verificação em 2 Fatores"}
                </h2>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {isBackupMode
                    ? "Digite um dos seus códigos de backup de 8 caracteres salvos na configuração."
                    : "Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador (Google Authenticator, Authy, etc.)."}
                </p>
              </div>

              {!isBackupMode ? (
                /* Modo TOTP (6 dígitos) */
                <form onSubmit={handleTotpFormSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mfa-login-code" className="sr-only">
                      Código de 6 dígitos
                    </Label>
                    <Input
                      id="mfa-login-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                        setTotpCode(val);
                        if (val.length === 6) {
                          handleVerifyMfaTotp(val);
                        }
                      }}
                      className="text-center font-mono text-2xl tracking-[0.4em] font-bold h-14 bg-background border-2 focus-visible:ring-primary"
                      required
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isMfaSubmitting || totpCode.length !== 6}
                    className="w-full h-11 text-sm font-semibold gap-2"
                  >
                    {isMfaSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Verificar e Acessar
                      </>
                    )}
                  </Button>

                  <div className="pt-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsBackupMode(true)}
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Não tem acesso ao app? Usar código de backup
                    </Button>
                  </div>
                </form>
              ) : (
                /* Modo Código de Backup */
                <form onSubmit={handleVerifyBackupCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mfa-backup-code" className="text-xs font-semibold text-foreground">
                      Código de Backup (8 caracteres)
                    </Label>
                    <Input
                      id="mfa-backup-code"
                      type="text"
                      autoComplete="off"
                      placeholder="Ex: ABCD-1234"
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      className="text-center font-mono text-lg font-bold tracking-widest h-12 bg-background border-2 uppercase"
                      required
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground text-center">
                      Insira com ou sem hífen. Cada código só pode ser usado uma única vez.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isMfaSubmitting || !backupCode.trim()}
                    className="w-full h-11 text-sm font-semibold gap-2"
                  >
                    {isMfaSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        Validar Código de Recuperação
                      </>
                    )}
                  </Button>

                  <div className="pt-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsBackupMode(false)}
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Voltar para Autenticador (TOTP)
                    </Button>
                  </div>
                </form>
              )}

              {/* Botão Cancelar / Voltar para formulário de login */}
              <div className="border-t border-border pt-4 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelMfa}
                  className="text-xs gap-1.5 w-full text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Cancelar e Voltar ao Início
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              <Sparkles className="size-5 text-primary" />
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
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
