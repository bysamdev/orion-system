import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { User, Bell, Shield, Loader2, Building2, FolderOpen, Mail, Copy, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { useUserProfile, useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileUpdateSchema } from "@/lib/validation";
import { useErrorHandler } from "@/lib/useErrorHandler";
import { invokeOrionFunction } from "@/lib/orion-functions";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handleError, handleValidationError } = useErrorHandler();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data: role } = useUserRole();
  
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');

  // Estados para alterar senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados para notificações
  const [emailNotifications, setEmailNotifications] = useState(profile?.email_notifications ?? true);
  const [pushNotifications, setPushNotifications] = useState(profile?.push_notifications ?? true);

  // Estados para integração
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://[YOUR_SUPABASE_REF].supabase.co'}/functions/v1/email-to-ticket`;
  
  const maskedWebhook = webhookUrl.length > 30 
    ? `${webhookUrl.substring(0, 15)}...${webhookUrl.substring(webhookUrl.length - 15)}`
    : '******************************';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast({ title: 'Copiado', description: 'URL do Webhook copiada para a área de transferência' });
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Fetch user's company only (not all companies for security)
  const { data: userCompany } = useQuery({
    queryKey: ['user-company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setDepartment(profile.department || '');
      setEmailNotifications(profile.email_notifications ?? true);
      setPushNotifications(profile.push_notifications ?? true);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const validationResult = profileUpdateSchema.safeParse({
        full_name: fullName,
        department: department || undefined,
        email_notifications: emailNotifications,
        push_notifications: pushNotifications
      });
      
      if (!validationResult.success) {
        handleValidationError(validationResult as { success: false; error: { errors: Array<{ message: string }> } }, 'Settings.updateProfile');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update(validationResult.data)
        .eq('id', profile?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({
        title: 'Sucesso',
        description: 'Perfil atualizado com sucesso',
      });
    },
    onError: (error) => {
      handleError(error, 'Settings.updateProfile', 'Erro ao atualizar perfil');
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) {
        throw new Error('Digite sua senha atual');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('As senhas não coincidem');
      }

      if (newPassword.length < 6) {
        throw new Error('A nova senha deve ter pelo menos 6 caracteres');
      }

      // Re-autenticar com a senha atual para verificar se está correta
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: currentPassword,
      });

      if (authError) {
        throw new Error('A senha atual está incorreta');
      }

      // Só atualiza a senha após re-autenticação bem-sucedida
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Enviar alerta de segurança por e-mail
      try {
        await invokeOrionFunction("send-password-changed-alert", {
          email: profile?.email,
          full_name: profile?.full_name || "Usuário",
        });
      } catch (emailError) {
        // Não falhar a operação se o e-mail não for enviado
      }
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: 'Sucesso',
        description: 'Senha alterada com sucesso!',
      });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'A senha atual está incorreta') {
        toast({
          title: 'Erro',
          description: 'A senha atual está incorreta',
          variant: 'destructive',
        });
      } else {
        handleError(error, 'Settings.changePassword', 'Erro ao alterar senha');
      }
    }
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Configurações</h1>
          <p className="text-muted-foreground mb-8">Gerencie suas preferências e configurações da conta</p>
          
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Segurança
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notificações
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Integrações
              </TabsTrigger>
            </TabsList>

            {/* Aba Perfil */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Perfil do Usuário
                  </CardTitle>
                  <CardDescription>Atualize suas informações pessoais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar Upload */}
                  <AvatarUpload
                    userId={profile?.id || ''}
                    currentAvatarUrl={null}
                    fullName={fullName}
                  />

                  {/* Informações da Empresa - Badges */}
                  <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="secondary" className="text-sm font-normal">
                        {userCompany?.name || 'Sem empresa'}
                      </Badge>
                    </div>
                    {department && (
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <Badge variant="outline" className="text-sm font-normal">
                          {department}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Campos Editáveis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Nome Completo</Label>
                      <Input 
                        id="profile-name"
                        name="profile-name"
                        autoComplete="name"
                        placeholder="Nome Completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input 
                        id="profile-email"
                        name="profile-email"
                        type="email"
                        autoComplete="email"
                        value={profile?.email || ''}
                        disabled
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        O email não pode ser alterado
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="profile-department">Departamento</Label>
                      <Input 
                        id="profile-department"
                        name="profile-department"
                        autoComplete="organization-title"
                        placeholder="Ex: TI, RH, Financeiro"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={() => updateProfileMutation.mutate()}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba Segurança */}
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Segurança
                  </CardTitle>
                  <CardDescription>Gerencie suas configurações de segurança</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Senha Atual</Label>
                    <Input 
                      id="current-password"
                      name="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input 
                      id="new-password"
                      name="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                    <Input 
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme a nova senha"
                    />
                  </div>
                  <Button 
                    onClick={() => changePasswordMutation.mutate()}
                    disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {changePasswordMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Alterando...
                      </>
                    ) : (
                      'Alterar Senha'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba Notificações */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notificações
                  </CardTitle>
                  <CardDescription>Configure suas preferências de notificação</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50 transition-all hover:border-primary/30">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2 text-sm font-bold">
                        Notificações de E-mail
                      </Label>
                      <p className="text-xs text-muted-foreground">Receba atualizações de tickets por e-mail</p>
                    </div>
                    <Switch 
                      checked={emailNotifications}
                      onCheckedChange={(val) => {
                        setEmailNotifications(val);
                        updateProfileMutation.mutate();
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50 transition-all hover:border-primary/30">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2 text-sm font-bold">
                        Notificações Push
                      </Label>
                      <p className="text-xs text-muted-foreground">Receba alertas em tempo real no seu navegador</p>
                    </div>
                    <Switch 
                      checked={pushNotifications}
                      onCheckedChange={(val) => {
                        setPushNotifications(val);
                        updateProfileMutation.mutate();
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba Integrações */}
            <TabsContent value="integrations">
              {['admin', 'gestor'].includes(role || '') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Integração E-mail-to-Ticket
                    </CardTitle>
                    <CardDescription>Configure o recebimento de chamados via e-mail</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>URL do Webhook (Supabase Edge Function)</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          id="webhook-url"
                          name="webhook-url"
                          autoComplete="off"
                          data-lpignore="true"
                          readOnly 
                          value={showWebhook ? webhookUrl : maskedWebhook}
                          className="bg-muted/50 font-mono text-sm"
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => setShowWebhook(!showWebhook)}
                              >
                                {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{showWebhook ? 'Ocultar URL' : 'Revelar URL'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                                {copiedWebhook ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copiar URL</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Configure seu provedor de e-mail (ex: SendGrid Inbound Parse ou Postmark) para enviar requisições POST para esta URL quando um e-mail for recebido no seu endereço de suporte.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
