import React, { useState } from 'react';

interface Ticket {
  id: string;
  requester: string;
  category: string;
  created: string;
  priority: 'high' | 'medium' | 'low';
  operator: string;
  status: 'open' | 'in-progress' | 'closed';
}

const mockTickets: Ticket[] = [
  {
    id: '#1010',
    requester: 'Cleber Junior',
    category: 'ERP',
    created: 'há 3h',
    priority: 'high',
    operator: 'Marcos Almeida',
    status: 'open'
  },
  {
    id: '#1292',
    requester: 'Roberto Mariano',
    category: 'E-mail',
    created: 'há 2h',
    priority: 'high',
    operator: 'Marcos Almeida',
    status: 'open'
  }
];

export const TicketsTable: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);

  const handleStartTicket = (ticketId: string) => {
    setTickets(prev => 
      prev.map(ticket => 
        ticket.id === ticketId 
          ? { ...ticket, status: 'in-progress' as const }
          : ticket
      )
    );
  };

  return (
    <section className="bg-[rgba(240,240,240,1)] flex flex-col items-stretch text-base pt-[9px] pb-[165px] px-2 rounded-[14px] max-md:max-w-full max-md:pb-[100px]">
      <div className="bg-[rgba(217,217,217,1)] flex w-full items-stretch gap-5 text-[rgba(37,37,37,1)] font-bold whitespace-nowrap flex-wrap justify-between pl-[22px] pr-20 py-[9px] rounded-[25px] max-md:max-w-full max-md:px-5">
        <div className="flex items-stretch gap-[33px]">
          <div>Ticket</div>
          <div>Solicitante</div>
        </div>
        <div>Categoria</div>
        <div className="flex items-stretch gap-[33px]">
          <div>Criado</div>
          <div>Prioridade</div>
        </div>
        <div className="flex items-stretch gap-[40px_73px]">
          <div>Operador</div>
          <div className="text-center">Status</div>
        </div>
      </div>
      
      <div className="self-center flex w-[885px] max-w-full items-stretch gap-5 text-[rgba(94,94,94,1)] font-normal flex-wrap justify-between mt-[23px]">
        <div className="flex flex-col items-stretch my-auto">
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className={`flex items-stretch gap-[29px] ${index > 0 ? 'mt-[26px]' : ''}`}>
              <div>{ticket.id}</div>
              <div className={index === 0 ? "basis-auto" : "grow shrink w-[118px]"}>
                {ticket.requester}
              </div>
            </div>
          ))}
        </div>
        
        <div>
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className={`flex items-stretch gap-5 justify-between ${index > 0 ? 'mt-6' : ''}`}>
              <div>{ticket.category}</div>
              <div>{ticket.created}</div>
              <img
                src="https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/df0bc80e9f02ffabe729367d0d4fe7277f1a5f6e?placeholderIfAbsent=true"
                alt="Priority indicator"
                className="aspect-[1.05] object-contain w-[22px] shrink-0"
              />
            </div>
          ))}
        </div>
        
        <div className="font-bold my-auto">
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className={index > 0 ? 'mt-[26px]' : ''}>
              {ticket.operator}
            </div>
          ))}
        </div>
        
        <div className="font-bold whitespace-nowrap">
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className={`flex items-stretch gap-1.5 ${index > 0 ? 'mt-5' : ''}`}>
              <img
                src="https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/2e62f3ae70c212423697f0db2d98188fc827dae3?placeholderIfAbsent=true"
                alt="Status icon"
                className="aspect-[1] object-contain w-6 shrink-0"
              />
              <button
                className="my-auto hover:text-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-1 transition-colors"
                onClick={() => handleStartTicket(ticket.id)}
                aria-label={`Start ticket ${ticket.id}`}
              >
                {ticket.status === 'in-progress' ? 'Em andamento' : 'Iniciar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
