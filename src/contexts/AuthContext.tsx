import { createContext, useContext, useEffect, useState } from 'react';
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
        supabase.auth.getSession().then(({ data: { session } }) => {
          // ⚠️ Somente em ambiente de desenvolvimento, e só com ?testAuth=1
          // explícito na URL. NUNCA usar só import.meta.env.DEV como guarda:
          // o script "build:dev" (vite build --mode development) gera um
          // bundle de PRODUÇÃO com DEV=true, e sem esse segundo fator
          // qualquer visitante de um deploy feito com esse script ganharia
          // sessão fake automaticamente, sem precisar de parâmetro nenhum.
          if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('testAuth')) {
            const testUserId = new URLSearchParams(window.location.search).get('testUserId') || 'test-user';
            setSession({ access_token: 'test', user: { id: testUserId, email: 'test@orion.com' } } as any);
            setUser({ id: testUserId, email: 'test@orion.com' } as any);
            setLoading(false);
            return;
          }
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
