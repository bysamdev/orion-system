import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { lazy, Suspense } from 'react';

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
const Monitoring = lazy(() => import("./pages/Monitoring"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const TicketHistory = lazy(() => import("./pages/TicketHistory"));
const Avaliacao = lazy(() => import("./pages/Avaliacao"));
const Assets = lazy(() => import("./pages/Assets"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Documentation = lazy(() => import("./pages/Documentation"));
const UserGuide = lazy(() => import("./pages/UserGuide"));
const AlertsDashboard = lazy(() => import("./pages/AlertsDashboard"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const PatchManagement = lazy(() => import("./pages/PatchManagement"));

const queryClient = new QueryClient();

const App = () => (
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
              <Route path="/auth" element={<Auth />} />
              <Route path="/definir-senha" element={<SetPassword />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/novo-ticket" element={<ProtectedRoute><NewTicket /></ProtectedRoute>} />
              <Route path="/ajustes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/monitoring" element={<ProtectedRoute><Monitoring /></ProtectedRoute>} />
              <Route path="/ticket/:id" element={<ProtectedRoute><TicketDetails /></ProtectedRoute>} />
              <Route path="/historico" element={<ProtectedRoute><TicketHistory /></ProtectedRoute>} />
              <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
              <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
              <Route path="/portal" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
              <Route path="/debug-tools" element={<ProtectedRoute><DebugTools /></ProtectedRoute>} />
              <Route path="/avaliacao/:id" element={<Avaliacao />} />
              <Route path="/documentacao" element={<ProtectedRoute><Documentation /></ProtectedRoute>} />
              <Route path="/tutorial" element={<ProtectedRoute><UserGuide /></ProtectedRoute>} />
              <Route path="/alertas" element={<ProtectedRoute><AlertsDashboard /></ProtectedRoute>} />
              <Route path="/automacoes" element={<ProtectedRoute><Automacoes /></ProtectedRoute>} />
              <Route path="/patches" element={<ProtectedRoute><PatchManagement /></ProtectedRoute>} />
              <Route path="/manual" element={<Navigate to="/tutorial" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
