import React from 'react';

interface DashboardHeaderProps {
  userName?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = "Samuel Terres"
}) => {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className="mb-8">
      <h1 className="text-4xl md:text-5xl font-light text-foreground tracking-tight">
        Olá <span className="font-bold">{userName}!</span>
      </h1>
      <p className="text-muted-foreground text-sm mt-2 capitalize font-medium">
        Hoje é {dateString}
      </p>
    </header>
  );
};