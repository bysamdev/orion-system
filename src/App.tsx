import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { lazy, Suspense } from 'react';
import { ThemeProvider } from "@/components/theme-provider";
import { UserRole } from '@/hooks/useUserRole';

const Index = lazy(() => import("./pages/Index"));
const NewTicket = lazy(() => import("./pages/NewTicket"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const TicketDetails = lazy(() => import("./pages/TicketDetails"));
const Auth = lazy(() => import("./pages/Auth"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DebugTools = lazy(() => import("./pages/DebugTools"));
const Reports = lazy(() => import("./pages/Reports"));
const InfrastructureDashboard = lazy(() => import("./pages/InfrastructureDashboard"));
const AlertsDashboard = lazy(() => import("./pages/AlertsDashboard"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const TicketHistory = lazy(() => import("./pages/TicketHistory"));
const Avaliacao = lazy(() => import("./pages/Avaliacao"));
const Assets = lazy(() => import("./pages/Assets"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const PatchManagement = lazy(() => import("./pages/PatchManagement"));
const Notifications = lazy(() => import("./pages/Notifications"));
const WebMonitoring = lazy(() => import("./pages/WebMonitoring"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 minutes - cache agressivo apoiado em Realtime para invalidação
      gcTime: 1000 * 60 * 60 * 2, // 2 hours
      retry: (failureCount, error: any) => {
        // Abort retry immediately for auth/RLS errors
        if (error?.code === 'PGRST301' || error?.code === '42501' || error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Invalidação acontece via Supabase Realtime
      refetchOnReconnect: false,
    },
  },
});
/** Wrapper: ProtectedRoute + DashboardLayout compartilhado */
const AppRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: UserRole[] }) => (
  <ProtectedRoute allowedRoles={allowedRoles}>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <ThemeProvider defaultTheme="system">
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Orion System</p>
              </div>
            </div>
          }>
            <Routes>
              {/* ── Rotas públicas (sem layout) ── */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Navigate to={{ pathname: "/auth", search: window.location.search }} replace />} />
              <Route path="/signin" element={<Navigate to={{ pathname: "/auth", search: window.location.search }} replace />} />
              <Route path="/entrar" element={<Navigate to={{ pathname: "/auth", search: window.location.search }} replace />} />
              <Route path="/logar" element={<Navigate to={{ pathname: "/auth", search: window.location.search }} replace />} />

              <Route path="/definir-senha" element={<SetPassword />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="/redefinir-senha" element={<SetPassword />} />
              <Route path="/reset-password" element={<SetPassword />} />

              <Route path="/avaliacao/:id" element={<Avaliacao />} />

              {/* ── Rotas autenticadas (com Sidebar + TopBar via DashboardLayout) ── */}
              <Route path="/" element={<AppRoute><Index /></AppRoute>} />
              <Route path="/novo-ticket" element={<AppRoute><NewTicket /></AppRoute>} />
              <Route path="/ajustes" element={<AppRoute><Settings /></AppRoute>} />
              <Route path="/admin" element={<AppRoute allowedRoles={['admin', 'developer']}><Admin /></AppRoute>} />
              <Route path="/relatorios" element={<AppRoute allowedRoles={['admin', 'developer']}><Reports /></AppRoute>} />
              <Route path="/sistemas" element={<AppRoute allowedRoles={['admin', 'developer', 'technician']}><InfrastructureDashboard /></AppRoute>} />
              <Route path="/monitoramento" element={<AppRoute><Monitoring /></AppRoute>} />
              <Route path="/central-alertas" element={<AppRoute><AlertsDashboard /></AppRoute>} />
              <Route path="/ticket/:id" element={<AppRoute><TicketDetails /></AppRoute>} />
              <Route path="/historico" element={<AppRoute><TicketHistory /></AppRoute>} />
              <Route path="/conhecimento" element={<AppRoute><KnowledgeBase /></AppRoute>} />
              <Route path="/ativos" element={<AppRoute allowedRoles={['admin', 'developer', 'technician']}><Assets /></AppRoute>} />
              <Route path="/monitoramento-web" element={<AppRoute allowedRoles={['admin', 'developer', 'technician']}><WebMonitoring /></AppRoute>} />
              <Route path="/portal" element={<AppRoute><ClientPortal /></AppRoute>} />
              <Route path="/debug" element={<AppRoute><DebugTools /></AppRoute>} />
              <Route path="/automacoes" element={<AppRoute allowedRoles={['admin', 'developer']}><Automacoes /></AppRoute>} />
              <Route path="/instaladores" element={<AppRoute allowedRoles={['admin', 'developer', 'technician']}><PatchManagement /></AppRoute>} />
              <Route path="/notificacoes" element={<AppRoute><Notifications /></AppRoute>} />

              {/* ── Aliases & Redirecionamentos: Service Desk ── */}
              <Route path="/novo" element={<Navigate to={{ pathname: "/novo-ticket", search: window.location.search }} replace />} />
              <Route path="/novo-chamado" element={<Navigate to={{ pathname: "/novo-ticket", search: window.location.search }} replace />} />
              <Route path="/abrir-chamado" element={<Navigate to={{ pathname: "/novo-ticket", search: window.location.search }} replace />} />
              <Route path="/abrir-ticket" element={<Navigate to={{ pathname: "/novo-ticket", search: window.location.search }} replace />} />
              <Route path="/new-ticket" element={<Navigate to={{ pathname: "/novo-ticket", search: window.location.search }} replace />} />
              <Route path="/create-ticket" element={<Navigate to={{ pathname: "/novo-ticket", search: window.location.search }} replace />} />

              <Route path="/history" element={<Navigate to={{ pathname: "/historico", search: window.location.search }} replace />} />
              <Route path="/tickets" element={<Navigate to={{ pathname: "/historico", search: window.location.search }} replace />} />
              <Route path="/chamados" element={<Navigate to={{ pathname: "/historico", search: window.location.search }} replace />} />
              <Route path="/meus-chamados" element={<Navigate to={{ pathname: "/historico", search: window.location.search }} replace />} />
              <Route path="/my-tickets" element={<Navigate to={{ pathname: "/historico", search: window.location.search }} replace />} />
              <Route path="/ticket-history" element={<Navigate to={{ pathname: "/historico", search: window.location.search }} replace />} />
              <Route path="/lista-tickets" element={<Navigate to={{ pathname: "/historico", search: window.location.search }} replace />} />

              <Route path="/manual" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/tutorial" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/base-conhecimento" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/knowledge" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/knowledge-base" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/documentacao" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/kb" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/wiki" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/ajuda" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/help" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/faq" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/docs" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />
              <Route path="/artigos" element={<Navigate to={{ pathname: "/conhecimento", search: window.location.search }} replace />} />

              {/* ── Aliases & Redirecionamentos: Infraestrutura & RMM ── */}
              <Route path="/infraestrutura" element={<Navigate to={{ pathname: "/sistemas", search: window.location.search }} replace />} />
              <Route path="/infrastructure" element={<Navigate to={{ pathname: "/sistemas", search: window.location.search }} replace />} />
              <Route path="/painel-infraestrutura" element={<Navigate to={{ pathname: "/sistemas", search: window.location.search }} replace />} />
              <Route path="/sistemas-alertas" element={<Navigate to={{ pathname: "/sistemas", search: window.location.search }} replace />} />

              <Route path="/monitoring" element={<Navigate to={{ pathname: "/sistemas", search: window.location.search }} replace />} />
              <Route path="/alertas" element={<Navigate to={{ pathname: "/sistemas", search: "tab=alertas" }} replace />} />
              <Route path="/alerts" element={<Navigate to={{ pathname: "/sistemas", search: "tab=alertas" }} replace />} />
              <Route path="/central-de-alertas" element={<Navigate to={{ pathname: "/central-alertas", search: window.location.search }} replace />} />

              <Route path="/assets" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />
              <Route path="/cmdb" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />
              <Route path="/inventario" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />
              <Route path="/inventory" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />
              <Route path="/equipamentos" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />
              <Route path="/devices" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />
              <Route path="/machines" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />
              <Route path="/maquinas" element={<Navigate to={{ pathname: "/ativos", search: window.location.search }} replace />} />

              <Route path="/web-monitoring" element={<Navigate to={{ pathname: "/monitoramento-web", search: window.location.search }} replace />} />
              <Route path="/webmonitoring" element={<Navigate to={{ pathname: "/monitoramento-web", search: window.location.search }} replace />} />
              <Route path="/sites" element={<Navigate to={{ pathname: "/monitoramento-web", search: window.location.search }} replace />} />
              <Route path="/uptime" element={<Navigate to={{ pathname: "/monitoramento-web", search: window.location.search }} replace />} />

              <Route path="/atualizacoes" element={<Navigate to={{ pathname: "/instaladores", search: window.location.search }} replace />} />
              <Route path="/updates" element={<Navigate to={{ pathname: "/instaladores", search: window.location.search }} replace />} />
              <Route path="/patches" element={<Navigate to={{ pathname: "/instaladores", search: window.location.search }} replace />} />
              <Route path="/software" element={<Navigate to={{ pathname: "/instaladores", search: window.location.search }} replace />} />
              <Route path="/softwares" element={<Navigate to={{ pathname: "/instaladores", search: window.location.search }} replace />} />
              <Route path="/patch-management" element={<Navigate to={{ pathname: "/instaladores", search: window.location.search }} replace />} />
              <Route path="/downloads" element={<Navigate to={{ pathname: "/instaladores", search: window.location.search }} replace />} />

              {/* ── Aliases & Redirecionamentos: Gestão & Administração ── */}
              <Route path="/cliente" element={<Navigate to={{ pathname: "/portal", search: window.location.search }} replace />} />
              <Route path="/area-cliente" element={<Navigate to={{ pathname: "/portal", search: window.location.search }} replace />} />
              <Route path="/area-do-cliente" element={<Navigate to={{ pathname: "/portal", search: window.location.search }} replace />} />
              <Route path="/client-portal" element={<Navigate to={{ pathname: "/portal", search: window.location.search }} replace />} />
              <Route path="/portal-cliente" element={<Navigate to={{ pathname: "/portal", search: window.location.search }} replace />} />
              <Route path="/cliente-portal" element={<Navigate to={{ pathname: "/portal", search: window.location.search }} replace />} />

              <Route path="/reports" element={<Navigate to={{ pathname: "/relatorios", search: window.location.search }} replace />} />
              <Route path="/relatorio" element={<Navigate to={{ pathname: "/relatorios", search: window.location.search }} replace />} />
              <Route path="/analytics" element={<Navigate to={{ pathname: "/relatorios", search: window.location.search }} replace />} />
              <Route path="/insights" element={<Navigate to={{ pathname: "/relatorios", search: window.location.search }} replace />} />

              <Route path="/administracao" element={<Navigate to={{ pathname: "/admin", search: window.location.search }} replace />} />
              <Route path="/painel-admin" element={<Navigate to={{ pathname: "/admin", search: window.location.search }} replace />} />
              <Route path="/administrador" element={<Navigate to={{ pathname: "/admin", search: window.location.search }} replace />} />
              <Route path="/gerenciamento" element={<Navigate to={{ pathname: "/admin", search: window.location.search }} replace />} />
              <Route path="/management" element={<Navigate to={{ pathname: "/admin", search: window.location.search }} replace />} />

              <Route path="/automations" element={<Navigate to={{ pathname: "/automacoes", search: window.location.search }} replace />} />
              <Route path="/automation" element={<Navigate to={{ pathname: "/automacoes", search: window.location.search }} replace />} />
              <Route path="/regras" element={<Navigate to={{ pathname: "/automacoes", search: window.location.search }} replace />} />
              <Route path="/rules" element={<Navigate to={{ pathname: "/automacoes", search: window.location.search }} replace />} />

              <Route path="/configuracoes" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />
              <Route path="/settings" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />
              <Route path="/perfil" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />
              <Route path="/profile" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />
              <Route path="/conta" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />
              <Route path="/account" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />
              <Route path="/meu-perfil" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />
              <Route path="/user-settings" element={<Navigate to={{ pathname: "/ajustes", search: window.location.search }} replace />} />

              <Route path="/notifications" element={<Navigate to={{ pathname: "/notificacoes", search: window.location.search }} replace />} />
              <Route path="/avisos" element={<Navigate to={{ pathname: "/notificacoes", search: window.location.search }} replace />} />
              <Route path="/inbox" element={<Navigate to={{ pathname: "/notificacoes", search: window.location.search }} replace />} />

              <Route path="/debug-tools" element={<Navigate to={{ pathname: "/debug", search: window.location.search }} replace />} />
              <Route path="/dev-tools" element={<Navigate to={{ pathname: "/debug", search: window.location.search }} replace />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
