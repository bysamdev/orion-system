import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/UserManagement';
import { CompanyManagement } from '@/components/admin/CompanyManagement';
import { ContractManagement } from '@/components/admin/ContractManagement';
import { CannedResponsesManagement } from '@/components/admin/CannedResponsesManagement';
import { RoutingRulesManagement } from '@/components/admin/RoutingRulesManagement';
import { ResolutionChecklistManagement } from '@/components/admin/ResolutionChecklistManagement';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Loader2, Settings2, Users, Building, FileText, MessageSquare, ListChecks, GitBranch, Book } from 'lucide-react';
import { SLAConfiguration } from '@/components/admin/SLAConfiguration';
import { Skeleton } from '@/components/ui/skeleton';
export default function Admin() {
  const { data: role, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500">
          <div className="mt-8">
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-96 mb-6" />
            
            <div className="bg-muted/50 p-1 rounded-xl flex space-x-2 w-max mb-6">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-9 w-32 rounded-lg" />)}
            </div>
            
            <Card className="border-border/50 shadow-sm mt-6">
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                  <div className="rounded-md border">
                    <div className="h-12 border-b bg-muted/30" />
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="p-4 flex items-center justify-between border-b last:border-0">
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Clientes não têm acesso à administração
  if (role !== 'admin' && role !== 'technician' && role !== 'developer') {
    return <Navigate to="/" replace />;
  }

  // Técnicos só acessam Respostas Prontas
  const isTechnician = role === 'technician';

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Administração</h1>
          <p className="text-muted-foreground mb-6">
            {isTechnician
              ? 'Gerencie respostas prontas para agilizar o atendimento'
              : 'Gerencie usuários, empresas, contratos e configurações'}
          </p>
          
          <Tabs defaultValue={isTechnician ? 'responses' : 'users'} className="w-full">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              {/* Abas exclusivas para admin/developer */}
              {!isTechnician && (
                <>
                  <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Usuários</TabsTrigger>
                  <TabsTrigger value="companies" className="gap-2"><Building className="w-4 h-4" /> Empresas</TabsTrigger>
                  <TabsTrigger value="contracts" className="gap-2"><FileText className="w-4 h-4" /> Contratos</TabsTrigger>
                  <TabsTrigger value="config" className="gap-2"><Settings2 className="w-4 h-4" /> Configurações</TabsTrigger>
                </>
              )}
              {/* Aba disponível para todos (admin, technician, developer) */}
              <TabsTrigger value="responses" className="gap-2"><MessageSquare className="w-4 h-4" /> Respostas Prontas</TabsTrigger>
              {!isTechnician && (
                <>
                  <TabsTrigger value="routing" className="gap-2"><GitBranch className="w-4 h-4" /> Roteamento</TabsTrigger>
                  <TabsTrigger value="checklists" className="gap-2"><ListChecks className="w-4 h-4" /> Checklists</TabsTrigger>
                </>
              )}
            </TabsList>
            
            {!isTechnician && (
              <>
                <TabsContent value="users" className="mt-6">
                  <UserManagement />
                </TabsContent>
                
                <TabsContent value="companies" className="mt-6">
                  <CompanyManagement />
                </TabsContent>

                <TabsContent value="contracts" className="mt-6">
                  <ContractManagement />
                </TabsContent>
                
                <TabsContent value="config" className="mt-6">
                  <SLAConfiguration />
                </TabsContent>
              </>
            )}
            
            <TabsContent value="responses" className="mt-6">
              <CannedResponsesManagement />
            </TabsContent>

            {!isTechnician && (
              <>
                <TabsContent value="routing" className="mt-6">
                  <RoutingRulesManagement />
                </TabsContent>
                <TabsContent value="checklists" className="mt-6">
                  <ResolutionChecklistManagement />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
}
