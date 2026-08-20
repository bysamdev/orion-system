import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  refreshAuth: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[AuthContext] Erro ao recuperar sessão:', error.message);
        setSession(null);
        setUser(null);
        return;
      }
      const currentSession = data?.session ?? null;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (err) {
      console.error('[AuthContext] Falha de rede ao obter sessão:', err);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    await fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    let isMounted = true;

    // Timeout de segurança absoluto: evita que o app fique travado caso a rede congele
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading((prevLoading) => {
          if (prevLoading) {
            console.warn('[AuthContext] Safety timeout (6s) atingido. Liberando loading da aplicação.');
            return false;
          }
          return false;
        });
      }
    }, 6000);

    // 1. Escuta mudanças em tempo real de autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!isMounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    // 2. Recupera a sessão persistida inicialmente
    fetchSession().finally(() => {
      if (isMounted) {
        clearTimeout(safetyTimer);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchSession]);

  const value = useMemo(
    () => ({ user, session, loading, refreshAuth }),
    [user, session, loading, refreshAuth]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
