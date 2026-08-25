import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, AlertTriangle, LogIn, Home } from 'lucide-react';
import { useUserRole, UserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const RedirectWithToast = () => {
  const location = useLocation();
  useEffect(() => {
    toast.error('Você não tem permissão para acessar essa área.');
  }, [location.pathname]);

  return <Navigate to={{ pathname: "/", search: window.location.search }} replace />;
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: isAuthLoading, refreshAuth } = useAuth();
  const { 
    data: role, 
    isLoading: isRoleLoading, 
    isError: isRoleError, 
    error: roleError,
    refetch: refetchRole 
  } = useUserRole();

  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [needsMfaElevation, setNeedsMfaElevation] = useState(false);

  // Verificação de garantia de autenticação 2FA (AAL)
  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    const checkMfa = async () => {
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (isMounted && aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
          setNeedsMfaElevation(true);
        }
      } catch (err) {
        console.warn('[ProtectedRoute] Erro ao verificar AAL:', err);
      }
    };

    checkMfa();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const isLoading = isAuthLoading || (!!user && isRoleLoading);

  // Timeout de segurança de 5 segundos para exibir opções de recuperação
  useEffect(() => {
    if (!isLoading) {
      setHasTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await refreshAuth();
      if (user?.id) {
        await refetchRole();
      }
    } catch (e) {
      console.error('[ProtectedRoute] Falha ao tentar novamente:', e);
    } finally {
      setIsRetrying(false);
    }
  };

  // 1. Estado de carregamento com feedback progressivo
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-4 max-w-sm">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary/80">
              Orion System
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {isAuthLoading ? 'Verificando sessão ativa...' : 'Carregando perfil e permissões...'}
            </p>
          </div>

          {hasTimedOut && (
            <div className="mt-4 p-4 rounded-lg bg-muted/60 border border-border/50 text-left space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A validação de credenciais está demorando mais que o habitual.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRetrying}
                  className="w-full rounded-md text-xs font-semibold gap-1.5 h-8 border-border/60"
                  onClick={handleRetry}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  Tentar Novamente
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 rounded-md text-xs font-semibold h-8"
                    onClick={() => window.location.reload()}
                  >
                    Recarregar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 rounded-md text-xs font-semibold h-8 text-destructive hover:text-destructive"
                    onClick={() => navigate('/auth')}
                  >
                    <LogIn className="w-3.5 h-3.5 mr-1" />
                    Ir para Login
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Não autenticado -> redireciona para login preservando rota de retorno
  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${returnUrl}`} replace />;
  }

  // 2.1. Sessão requer desafio 2FA (AAL2) pendente -> redireciona para tela de 2FA
  if (needsMfaElevation) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Falha ao consultar role do usuário (evita bloquear admins acidentalmente por erro temporário)
  if (isRoleError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-4 max-w-md p-6 bg-card rounded-lg border border-border shadow-lg">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1 text-center">
            <h3 className="font-bold text-base text-foreground">
              Falha ao Carregar Permissões
            </h3>
            <p className="text-xs text-muted-foreground">
              Não foi possível validar seu nível de acesso devido a uma instabilidade de rede.
            </p>
            {roleError instanceof Error && (
              <p className="text-[11px] font-mono text-muted-foreground/60 bg-muted/40 p-2 rounded-lg mt-2 text-left break-all">
                {roleError.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 w-full pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRetrying}
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 h-9"
              onClick={handleRetry}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              Tentar Novamente
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 h-9"
              onClick={() => window.location.reload()}
            >
              Recarregar Página
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Verificação de papéis autorizados (RBAC)
  const effectiveRole: UserRole = role || 'customer';

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(effectiveRole)) {
      return <RedirectWithToast />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
