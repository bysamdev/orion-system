import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { User, Bell, Shield, Loader2, Building2, FolderOpen } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { useUserProfile } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileUpdateSchema } from "@/lib/validation";
import { useErrorHandler } from "@/lib/useErrorHandler";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handleError, handleValidationError } = useErrorHandler();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');

  // Estados para alterar senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const validationResult = profileUpdateSchema.safeParse({
        full_name: fullName,
        department: department || undefined
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
      if (newPassword !== confirmPassword) {
        throw new Error('As senhas não coincidem');
      }

      if (newPassword.length < 6) {
        throw new Error('A nova senha deve ter pelo menos 6 caracteres');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Enviar alerta de segurança por e-mail
      try {
        await supabase.functions.invoke('send-password-changed-alert', {
          body: {
            email: profile?.email,
            full_name: profile?.full_name || 'Usuário',
          },
        });
      } catch (emailError) {
        console.error('Erro ao enviar alerta de segurança:', emailError);
        // Não falhar a operação se o e-mail não for enviado
      }
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: 'Sucesso',
        description: 'Senha alterada com sucesso. Um alerta foi enviado para seu e-mail.',
      });
    },
    onError: (error) => {
      handleError(error, 'Settings.changePassword', 'Erro ao alterar senha');
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
        <TopBar />
        
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Configurações</h1>
          <p className="text-muted-foreground mb-8">Gerencie suas preferências e configurações da conta</p>
          
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
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
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input 
                        id="name" 
                        placeholder="Nome Completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={profile?.email || ''}
                        disabled
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        O email não pode ser alterado
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="department">Departamento</Label>
                      <Input 
                        id="department" 
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
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input 
                      id="new-password" 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                    <Input 
                      id="confirm-password" 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme a nova senha"
                    />
                  </div>
                  <Button 
                    onClick={() => changePasswordMutation.mutate()}
                    disabled={changePasswordMutation.isPending || !newPassword || !confirmPassword}
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
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        Notificações de E-mail
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs font-normal text-muted-foreground cursor-help">
                              Em breve
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Esta funcionalidade será disponibilizada em breve</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <p className="text-sm text-muted-foreground">Receba atualizações por e-mail</p>
                    </div>
                    <Switch disabled />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        Notificações Push
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs font-normal text-muted-foreground cursor-help">
                              Em breve
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Esta funcionalidade será disponibilizada em breve</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <p className="text-sm text-muted-foreground">Receba notificações no navegador</p>
                    </div>
                    <Switch disabled />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
