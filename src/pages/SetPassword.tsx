import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invokeOrionFunction } from '@/lib/orion-functions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { z } from 'zod';

// Schema de validação
const passwordSchema = z.object({
  password: z.string()
    .min(6, 'A senha deve ter no mínimo 6 caracteres')
    .max(72, 'A senha deve ter no máximo 72 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function SetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  const token = searchParams.get('token');
  // Duas origens para esta tela: o convite do Orion (?token=, tabela
  // invite_tokens) e o "Esqueci a senha" do Supabase, cujo link abre uma
  // sessão de recuperação (evento PASSWORD_RECOVERY). Antes só o convite era
  // tratado, e a recuperação terminava em "Token não fornecido" (ORN-BUG-01).
  const [modoRecuperacao, setModoRecuperacao] = useState(false);

  useEffect(() => {
    if (token) {
      setTokenValid(true);
      setIsValidating(false);
      return;
    }

    let resolvido = false;
    const aceitar = () => {
      resolvido = true;
      setModoRecuperacao(true);
      setTokenValid(true);
      setIsValidating(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') aceitar();
    });

    // O cliente troca o código do link pela sessão logo ao carregar; se o
    // evento já passou, a sessão de recuperação está ativa.
    const url = window.location.href;
    const veioDoLink = /[?&#](code|type=recovery|access_token)=?/.test(url);
    const espera = setTimeout(async () => {
      if (resolvido) return;
      const { data } = await supabase.auth.getSession();
      if (data.session && veioDoLink) {
        aceitar();
      } else {
        setTokenError('Link inválido ou expirado. Peça um novo em "Esqueci a senha".');
        setTokenValid(false);
        setIsValidating(false);
      }
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(espera);
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validação com Zod
    const validation = passwordSchema.safeParse(formData);
    
    if (!validation.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {};
      validation.error.errors.forEach((error) => {
        const field = error.path[0] as 'password' | 'confirmPassword';
        fieldErrors[field] = error.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      if (modoRecuperacao) {
        const { error: erroRecuperacao } = await supabase.auth.updateUser({ password: formData.password });
        if (erroRecuperacao) throw erroRecuperacao;
        await supabase.auth.signOut();
        toast({ title: 'Senha redefinida!', description: 'Entre com a nova senha.' });
        setTimeout(() => navigate('/auth'), 1500);
        return;
      }

      // Chamar edge function para resetar senha com token
      const { data, error } = await invokeOrionFunction<{ success?: boolean; message?: string; error?: string }>(
        'reset-password-with-token',
        {
          token: token,
          newPassword: formData.password,
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Senha definida com sucesso!',
        description: 'Você pode fazer login agora',
      });

      // Redirecionar para login
      setTimeout(() => {
        navigate('/auth');
      }, 1500);

    } catch (error) {
      console.error('Erro ao definir senha:', error);
      toast({
        title: 'Erro ao definir senha',
        description: (error as Error).message || 'Ocorreu um erro ao definir sua senha. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar loading enquanto valida
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Validando link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Orion System</h1>
        </div>

        {/* Card do Formulário */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              {!tokenValid ? 'Link inválido' : modoRecuperacao ? 'Redefinir senha' : 'Bem-vindo!'}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {tokenValid 
                ? 'Defina sua senha de acesso para começar a usar o sistema'
                : 'Não foi possível validar o link'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mostrar erro se token inválido */}
            {!tokenValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {tokenError}
                </AlertDescription>
              </Alert>
            )}

            {/* Mostrar formulário apenas se token válido */}
            {tokenValid && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Nova Senha */}
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isLoading}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Campo Confirmar Senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Digite a senha novamente"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={isLoading}
                  className={errors.confirmPassword ? 'border-destructive' : ''}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Botão Submeter */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Senha e Entrar'
                )}
              </Button>
            </form>
            )}
          </CardContent>
        </Card>

        {/* Informação adicional */}
        {tokenValid && (
          <p className="text-center text-sm text-muted-foreground">
            Sua senha deve ter no mínimo 6 caracteres e será usada para acessar o sistema
          </p>
        )}
      </div>
    </div>
  );
}
