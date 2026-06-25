import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useTimerGuard } from '@/hooks/useTimerGuard';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** largura máxima da área de conteúdo. Padrão: 1600px */
  maxWidth?: string;
}

/**
 * Layout raiz compartilhado por todas as páginas autenticadas.
 *
 * Desktop (≥768px): Sidebar fixa à esquerda + TopBar sticky no topo.
 * Mobile (<768px): Sidebar oculta, acessível via Sheet Drawer ao clicar no ☰.
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  maxWidth = '1600px',
}) => {
  useTimerGuard();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar Desktop (hidden on mobile) ── */}
      <div className="hidden md:flex">
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* ── Sidebar Mobile: Sheet Drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Área principal ── */}
      <div className="flex flex-col flex-1 overflow-y-auto min-w-0">
        {/* TopBar sticky */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border/30 px-4 md:px-8 py-3 flex items-center gap-3">
          {/* Hamburger — só visível em mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 h-9 w-9"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <TopBar />
          </div>
        </div>

        {/* Conteúdo da rota */}
        <main
          className="flex-1 px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-8 w-full mx-auto"
          style={{ maxWidth }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
