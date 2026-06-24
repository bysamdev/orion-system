import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/lib/useErrorHandler';
import { Loader2 } from 'lucide-react';


import orionLogo from '@/assets/orion-logo.png';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [machineToken, setMachineToken] = useState<string | null>(null);
  const [isDetectingAgent, setIsDetectingAgent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setEmail('');
    setPassword('');
    localStorage.removeItem('lastEmail'); // clean up any old persist behavior
  }, []);

  useEffect(() => {
    const detectAgent = async () => {
      setIsDetectingAgent(true);
      try {
        const response = await fetch('http://127.0.0.1:8081/token');
        if (response.ok) {
          const data = await response.json();
          setMachineToken(data.machine_token);
          toast({
            title: "Agente Orion Detectado",
            description: "Identificação automática de máquina ativada.",
          });
        }
      } catch (err) {
        console.log("Agent not found locally");
      } finally {
        setIsDetectingAgent(false);
      }
    };

    detectAgent();
  }, [toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Erro', description: 'Preencha email e senha.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsSubmitting(false);

    if (error) {
      handleError(error, 'Auth.handleLogin', 'Credenciais inválidas. Verifique seu email e senha.');
    } else {
      if (machineToken) {
        localStorage.setItem('orion_machine_token', machineToken);
      }
      navigate('/');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={orionLogo} 
              alt="Orion System Logo" 
              className="h-20 w-auto"
            />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">Orion System</CardTitle>
            <CardDescription>
              Sistema de Gerenciamento de Chamados
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
              <Input 
                type="email" 
                placeholder="seu@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off" 
                name="login-email-unique" 
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Senha</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
