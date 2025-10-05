import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { Sidebar } from './Sidebar';
import { TicketsTable } from './TicketsTable';
import { RightSidebar } from './RightSidebar';
import { TopBar } from './TopBar';
import { ClosedTickets } from './ClosedTickets';
import { StatsReport } from './StatsReport';

export const Dashboard: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <TopBar />
        <DashboardHeader userName="Samuel" />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <TicketsTable />
            <ClosedTickets />
          </div>
          
          <div className="space-y-6">
            <StatsReport />
          </div>
        </div>
      </main>
      
      <RightSidebar />
    </div>
  );
};

export default Dashboard;
