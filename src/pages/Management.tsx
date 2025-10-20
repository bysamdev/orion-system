import React from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyUserManagement } from '@/components/management/CompanyUserManagement';
import { DepartmentManagement } from '@/components/management/DepartmentManagement';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Management() {
  const { data: role, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestão</h1>
          <p className="text-muted-foreground mb-6">Gerencie os usuários e setores da sua empresa</p>
          
          <Tabs defaultValue="users" className="w-full">
            <TabsList>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="departments">Setores</TabsTrigger>
            </TabsList>
            
            <TabsContent value="users" className="mt-6">
              <CompanyUserManagement />
            </TabsContent>
            
            <TabsContent value="departments" className="mt-6">
              <DepartmentManagement />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
