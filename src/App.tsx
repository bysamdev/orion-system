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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: false, // Prevents duplicate fetches on tab switch
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
              <Route path="/definir-senha" element={<SetPassword />} />
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
              <Route path="/knowledge" element={<AppRoute><KnowledgeBase /></AppRoute>} />
              <Route path="/assets" element={<AppRoute allowedRoles={['admin', 'developer', 'technician']}><Assets /></AppRoute>} />
              <Route path="/portal" element={<AppRoute><ClientPortal /></AppRoute>} />
              <Route path="/debug-tools" element={<AppRoute><DebugTools /></AppRoute>} />
              <Route path="/automacoes" element={<AppRoute allowedRoles={['admin', 'developer']}><Automacoes /></AppRoute>} />
              <Route path="/patches" element={<AppRoute allowedRoles={['admin', 'developer', 'technician']}><PatchManagement /></AppRoute>} />
              <Route path="/notificacoes" element={<AppRoute><Notifications /></AppRoute>} />
              <Route path="/manual" element={<Navigate to="/knowledge" replace />} />
              <Route path="/tutorial" element={<Navigate to="/knowledge" replace />} />
              <Route path="/base-conhecimento" element={<Navigate to={{ pathname: "/knowledge", search: window.location.search }} replace />} />
              <Route path="/configuracoes" element={<Navigate to="/ajustes" replace />} />
              <Route path="/settings" element={<Navigate to="/ajustes" replace />} />
              <Route path="/history" element={<Navigate to="/historico" replace />} />
              <Route path="/novo" element={<Navigate to="/novo-ticket" replace />} />
              <Route path="/notifications" element={<Navigate to="/notificacoes" replace />} />
              <Route path="/documentacao" element={<Navigate to="/knowledge" replace />} />
              <Route path="/ativos" element={<Navigate to={{ pathname: "/assets", search: window.location.search }} replace />} />
              <Route path="/cmdb" element={<Navigate to={{ pathname: "/assets", search: window.location.search }} replace />} />
              <Route path="/administracao" element={<Navigate to="/admin" replace />} />
              <Route path="/painel-admin" element={<Navigate to="/admin" replace />} />
              <Route path="/cliente" element={<Navigate to="/portal" replace />} />
              <Route path="/area-cliente" element={<Navigate to="/portal" replace />} />
              <Route path="/atualizacoes" element={<Navigate to="/patches" replace />} />
              <Route path="/updates" element={<Navigate to="/patches" replace />} />

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
