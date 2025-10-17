import React from 'react';
interface DashboardHeaderProps {
  userName?: string;
}
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = "Samuel"
}) => {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return <header className="mb-8">
      <h1 className="text-4xl md:text-5xl font-light text-foreground">
        Olá <span className="font-bold">{userName}!</span>
      </h1>
      <p className="text-muted-foreground text-sm mt-2 capitalize">
        Hoje é {dateString}
      </p>
      
    </header>;
};