import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { Sidebar } from './Sidebar';
import { TicketsTable } from './TicketsTable';
import { RightSidebar } from './RightSidebar';

export const Dashboard: React.FC = () => {
  return (
    <div className="bg-white overflow-hidden pr-[31px] pt-2.5 max-md:pr-5">
      <DashboardHeader userName="Samuel" />
      
      <main className="flex gap-5 justify-between mt-[5px]">
        <Sidebar />
        <TicketsTable />
        <RightSidebar />
      </main>
    </div>
  );
};

export default Dashboard;
