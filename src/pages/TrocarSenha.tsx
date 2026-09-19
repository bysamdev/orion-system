import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Lock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { invokeOrionFunction } from '@/lib/orion-functions';
import { deveTrocarSenha, problemaNaSenha } from '@/lib/senhaProvisoria';

// Troca obrigatória da senha provisória: a do e-mail de boas-vindas ou a
// temporária que o gestor definiu. O ProtectedRoute manda para cá enquanto
// app_metadata.deve_trocar_senha estiver ligado; o backend desliga ao salvar.
export default function TrocarSenha() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!deveTrocarSenha(user)) return <Navigate to="/" replace />;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = problemaNaSenha(senha, confirmacao);
    setErro(problema);
    if (problema) return;

    setSalvando(true);
    const { error } = await invokeOrionFunction('trocar-senha-provisoria', { newPassword: senha });
    if (error) {
      setErro(error.message || 'Não foi possível salvar a nova senha.');
      setSalvando(false);
      return;
    }
    // A sessão atual ainda traz a marca antiga no token; renovar busca o
    // app_metadata atualizado antes de liberar as outras telas.
    await supabase.auth.refreshSession();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Lock className="w-7 h-7 text-primary" aria-hidden />
          </div>
          <h1 className="text-xl font-bold">Orion System</h1>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl">Crie a sua senha</CardTitle>
            <CardDescription>
              Você entrou com uma senha provisória. Para continuar, escolha a senha que vai usar daqui em diante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  id="nova-senha"
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  disabled={salvando}
                  aria-describedby="regra-senha"
                />
                <p id="regra-senha" className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <Input
                  id="confirmar-senha"
                  type="password"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={e => setConfirmacao(e.target.value)}
                  disabled={salvando}
                />
              </div>
              {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
              <Button type="submit" className="w-full" disabled={salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar e entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); navigate('/auth', { replace: true }); }}
          className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" aria-hidden /> Sair
        </button>
      </div>
    </div>
  );
}
