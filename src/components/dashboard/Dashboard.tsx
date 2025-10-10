import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { TicketsTable } from './TicketsTable';
import { TopBar } from './TopBar';
import { ClosedTickets } from './ClosedTickets';
import { StatsReport } from './StatsReport';
import { QuickStats } from './QuickStats';

export const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        <DashboardHeader userName="Samuel" />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TicketsTable />
            <ClosedTickets />
          </div>
          
          <div className="space-y-6">
            <StatsReport />
            <QuickStats />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
