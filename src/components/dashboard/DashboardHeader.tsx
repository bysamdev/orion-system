import React from 'react';

interface DashboardHeaderProps {
  userName?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = "Samuel Terres"
}) => {
  const currentDate = new Date();
  const currentHour = currentDate.getHours();
  
  const greeting = currentHour < 12 
    ? 'Bom dia' 
    : currentHour < 18 
      ? 'Boa tarde' 
      : 'Boa noite';

  const dateString = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className="mb-6 pb-2">
      <p className="text-xs text-muted-foreground capitalize font-medium mb-1">
        {dateString}
      </p>
      <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
        {greeting}, <span className="text-primary">{userName}</span> 👋
      </h1>
    </header>
  );
};