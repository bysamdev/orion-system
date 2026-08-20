import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

interface DashboardHeaderProps {
  userName?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = "Usuário"
}) => {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <PageHeader
      icon={LayoutDashboard}
      badge="COCKPIT OPERACIONAL"
      title={`Olá, ${userName}!`}
      description={`Hoje é ${dateString} — Visão consolidada da fila de atendimento, SLA e carga de trabalho.`}
      className="mb-8"
    />
  );
};