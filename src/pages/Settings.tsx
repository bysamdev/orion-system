import React from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Bell, Shield, Database } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Ajustes</h1>
          <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        <div className="space-y-6">
          {/* Perfil do Usuário */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Perfil do Usuário</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" defaultValue="Samuel" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" defaultValue="samuel@exemplo.com" className="mt-2" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Cargo</Label>
                  <Input id="role" defaultValue="Operador" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Input id="department" defaultValue="TI" className="mt-2" />
                </div>
              </div>
              <Button className="mt-4">Salvar Alterações</Button>
            </div>
          </Card>

          {/* Notificações */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Notificações</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Notificações de Novos Tickets</p>
                  <p className="text-sm text-muted-foreground">Receba alertas quando novos tickets forem criados</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Notificações de Atualização</p>
                  <p className="text-sm text-muted-foreground">Receba alertas quando tickets forem atualizados</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">E-mail de Resumo Diário</p>
                  <p className="text-sm text-muted-foreground">Receba um resumo diário dos tickets</p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>

          {/* Segurança */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Segurança</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="current-password">Senha Atual</Label>
                <Input id="current-password" type="password" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input id="new-password" type="password" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input id="confirm-password" type="password" className="mt-2" />
              </div>
              <Button className="mt-4">Alterar Senha</Button>
            </div>
          </Card>

          {/* Sistema */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Sistema</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Modo Escuro</p>
                  <p className="text-sm text-muted-foreground">Ativar tema escuro na interface</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Atualização Automática</p>
                  <p className="text-sm text-muted-foreground">Atualizar dados automaticamente</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
