import type { ElementType } from 'react';
import {
  AppWindow, Boxes, Cpu, Mail, MoreHorizontal, Network, Printer, Server, UserPlus,
} from 'lucide-react';

// Categorias de chamado aceitas pelo banco (constraint tickets_category_valid,
// migration 20260918070000). Fonte única para rótulo e ícone em filtros,
// cartões e badges: um filtro que oferece categoria fora desta lista não casa
// com chamado nenhum.
export const CATEGORIAS: Record<string, { rotulo: string; icone: ElementType }> = {
  erp: { rotulo: 'ERP', icone: Boxes },
  email: { rotulo: 'E-mail', icone: Mail },
  hardware: { rotulo: 'Hardware', icone: Cpu },
  software: { rotulo: 'Software', icone: AppWindow },
  rede: { rotulo: 'Rede', icone: Network },
  criacao_usuario: { rotulo: 'Criação de usuário', icone: UserPlus },
  impressora: { rotulo: 'Impressora', icone: Printer },
  infraestrutura: { rotulo: 'Infraestrutura', icone: Server },
  outros: { rotulo: 'Outros', icone: MoreHorizontal },
};
