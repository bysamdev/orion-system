import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** largura máxima da área de conteúdo. Padrão: 1600px */
  maxWidth?: string;
}

/**
 * Layout raiz compartilhado por todas as páginas autenticadas.
 * Garante que Sidebar e TopBar apareçam de forma idêntica em todas as rotas.
 *
 * Estrutura:
 *   <div flex h-screen overflow-hidden>        ← âncora da tela toda
 *     <Sidebar />                              ← fixa à esquerda, h-screen
 *     <div flex-1 flex-col overflow-auto>      ← área de conteúdo scrollável
 *       <TopBar />                             ← sempre no topo do conteúdo
 *       <main>                                 ← conteúdo da página
 *         {children}
 *       </main>
 *     </div>
 *   </div>
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  maxWidth = '1600px',
}) => {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Barra lateral fixa */}
      <Sidebar />

      {/* Área principal — scroll vertical independente */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* TopBar sempre visível no topo */}
        <div
          className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border/40 px-8 py-4"
        >
          <TopBar />
        </div>

        {/* Conteúdo da rota */}
        <main
          className="flex-1 px-8 py-6 lg:px-12 lg:py-8 w-full mx-auto"
          style={{ maxWidth }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
