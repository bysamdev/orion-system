import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
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

  useEffect(() => {
    let isMounted = true;

    // Timeout de segurança absoluto: nunca deixa o app preso em loading caso a rede trave
    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('[AuthContext] Safety timeout acionado. Liberando loading do app.');
        setLoading(false);
      }
    }, 3000);

    // 1. Escuta mudanças de estado do Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!isMounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    );

    // 2. Recupera sessão inicial com tratamento defensivo de erros
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;

        if (error) {
          console.error("Error getting session:", error.message);
          setSession(null);
          setUser(null);
          return;
        }

        const currentSession = data?.session ?? null;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      })
      .catch((err) => {
        console.error('[AuthContext] Falha ao obter sessão do Supabase:', err);
        if (isMounted) {
          setSession(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, session, loading }), [user, session, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
