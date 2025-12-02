import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

  // Validar token ao carregar a página
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError('Token não fornecido na URL');
        setIsValidating(false);
        return;
      }

      try {
        // Buscar token na tabela invite_tokens
        const { data, error } = await supabase
          .from('invite_tokens')
          .select('email, expires_at')
          .eq('token', token)
          .maybeSingle();

        if (error) {
          console.error('Erro ao validar token:', error);
          setTokenError('Erro ao validar token');
          setIsValidating(false);
          return;
        }

        if (!data) {
          setTokenError('Link inválido ou já utilizado');
          setIsValidating(false);
          return;
        }

        // Verificar se expirou
        const expiresAt = new Date(data.expires_at);
        const now = new Date();

        if (now > expiresAt) {
          setTokenError('Link expirado. Solicite um novo convite ao administrador.');
          setIsValidating(false);
          return;
        }

        // Token válido
        setTokenValid(true);
        setIsValidating(false);
      } catch (error: any) {
        console.error('Erro ao validar token:', error);
        setTokenError('Erro ao validar token');
        setIsValidating(false);
      }
    };

    validateToken();
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
      // Chamar edge function para resetar senha com token
      const { data, error } = await supabase.functions.invoke('reset-password-with-token', {
        body: {
          token: token,
          newPassword: formData.password,
        },
      });

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

    } catch (error: any) {
      console.error('Erro ao definir senha:', error);
      toast({
        title: 'Erro ao definir senha',
        description: error.message || 'Ocorreu um erro ao definir sua senha. Tente novamente.',
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
          <p className="text-muted-foreground">Validando convite...</p>
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
              {tokenValid ? 'Bem-vindo!' : 'Erro no Convite'}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {tokenValid 
                ? 'Defina sua senha de acesso para começar a usar o sistema'
                : 'Não foi possível validar seu link de convite'
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
