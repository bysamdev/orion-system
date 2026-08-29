import React from 'react';
import { AppSidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useTimerGuard } from '@/hooks/useTimerGuard';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** largura máxima da área de conteúdo. Padrão: 1600px */
  maxWidth?: string;
}

/**
 * Layout raiz compartilhado por todas as páginas autenticadas.
 *
 * Utiliza o shadcn/ui Sidebar para gerenciar a navegação.
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  maxWidth = '1600px',
}) => {
  useTimerGuard();

  React.useEffect(() => {
    // Garante que o cookie de estado da sidebar seja redefinido para sempre aberto
    document.cookie = 'sidebar_state=true; path=/; max-age=31536000';
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="min-w-0 flex-1 overflow-x-hidden">
        {/* TopBar sticky com botão de menu mobile */}
        <header className="flex sticky top-0 bg-background/80 backdrop-blur-sm h-16 shrink-0 items-center gap-2 sm:gap-3 border-b border-border/30 px-3 sm:px-6 lg:px-8 z-30">
          <SidebarTrigger className="shrink-0 -ml-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary" />
          <div className="flex-1 min-w-0">
            <TopBar />
          </div>
        </header>

        {/* Conteúdo da rota */}
        <main
          className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6 w-full mx-auto min-w-0"
          style={{ maxWidth }}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardLayout;
