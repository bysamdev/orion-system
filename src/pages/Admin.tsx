import React from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/UserManagement';
import { CompanyManagement } from '@/components/admin/CompanyManagement';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Admin() {
  const { data: role, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'admin' && role !== 'developer') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Administração</h1>
          <p className="text-muted-foreground mb-6">Gerencie usuários, empresas e configurações do sistema</p>
          
          <Tabs defaultValue="users" className="w-full">
            <TabsList>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="companies">Empresas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="users" className="mt-6">
              <UserManagement />
            </TabsContent>
            
            <TabsContent value="companies" className="mt-6">
              <CompanyManagement />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
