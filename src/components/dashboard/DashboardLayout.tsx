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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* TopBar sticky */}
        <header className="flex sticky top-0 bg-background/80 backdrop-blur-sm h-16 shrink-0 items-center gap-2 border-b border-border/30 px-4 md:px-8 z-30">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <div className="flex-1 min-w-0">
            <TopBar />
          </div>
        </header>

        {/* Conteúdo da rota */}
        <main
          className="flex-1 px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-8 w-full mx-auto"
          style={{ maxWidth }}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardLayout;
