import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { Sidebar } from './Sidebar';
import { TicketsTable } from './TicketsTable';
import { RightSidebar } from './RightSidebar';

export const Dashboard: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <DashboardHeader userName="Samuel" />
        <TicketsTable />
      </main>
      
      <RightSidebar />
    </div>
  );
};

export default Dashboard;
