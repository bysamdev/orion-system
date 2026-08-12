import { Ticket } from "@/hooks/useTickets";

export const MOCK_TICKETS: Ticket[] = [
  {
    id: "mock-ticket-1",
    ticket_number: 1001,
    title: "Computador não liga",
    description: "O computador do setor financeiro parou de ligar após a queda de energia.",
    requester_name: "Maria Silva",
    category: "Hardware",
    priority: "high",
    status: "open",
    operator_name: null,
    assigned_to: null,
    assigned_to_user_id: null,
    department: "Financeiro",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 horas atrás
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    company_id: "company-1",
    company_name: "Empresa Cliente A",
    sla_due_date: new Date(Date.now() + 3600000 * 2).toISOString(), // Vence em 2 horas
    first_response_at: null,
    resolved_at: null,
    sla_status: "ok",
    remote_id: null,
    remote_password: null,
    sla_paused_at: null,
    sla_accumulated_pause_minutes: null,
    contract_id: null,
    asset_id: null,
    metadata: null
  },
  {
    id: "mock-ticket-2",
    ticket_number: 1002,
    title: "Erro no sistema ERP",
    description: "Ao tentar emitir uma nota fiscal, o sistema apresenta o erro 500.",
    requester_name: "João Santos",
    category: "Software",
    priority: "urgent",
    status: "in-progress",
    operator_name: "Usuário Teste",
    assigned_to: "Usuário Teste (Homologação)",
    assigned_to_user_id: "test-user",
    department: "Faturamento",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 dia atrás
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    company_id: "company-2",
    company_name: "Empresa Cliente B",
    sla_due_date: new Date(Date.now() - 3600000 * 2).toISOString(), // Vencido há 2 horas
    first_response_at: new Date(Date.now() - 3600000 * 23).toISOString(),
    resolved_at: null,
    sla_status: "breached",
    remote_id: "123 456 789",
    remote_password: "abc",
    sla_paused_at: null,
    sla_accumulated_pause_minutes: null,
    contract_id: null,
    asset_id: null,
    metadata: null
  },
  {
    id: "mock-ticket-3",
    ticket_number: 1003,
    title: "Configuração de e-mail no celular",
    description: "Preciso configurar meu e-mail corporativo no meu novo iPhone.",
    requester_name: "Ana Pereira",
    category: "Suporte",
    priority: "medium",
    status: "in-progress",
    operator_name: "Usuário Teste",
    assigned_to: "Usuário Teste (Homologação)",
    assigned_to_user_id: "test-user",
    department: "Vendas",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 dias atrás
    updated_at: new Date(Date.now() - 3600000 * 10).toISOString(),
    company_id: "company-1",
    company_name: "Empresa Cliente A",
    sla_due_date: new Date(Date.now() + 3600000 * 24).toISOString(), // Vence em 1 dia
    first_response_at: new Date(Date.now() - 3600000 * 47).toISOString(),
    resolved_at: null,
    sla_status: "ok",
    remote_id: null,
    remote_password: null,
    sla_paused_at: null,
    sla_accumulated_pause_minutes: null,
    contract_id: null,
    asset_id: null,
    metadata: null
  },
  {
    id: "mock-ticket-4",
    ticket_number: 1004,
    title: "Acesso à VPN bloqueado",
    description: "Não consigo acessar a VPN desde hoje de manhã.",
    requester_name: "Carlos Lima",
    category: "Redes",
    priority: "high",
    status: "resolved",
    operator_name: "Outro Técnico",
    assigned_to: "Outro Técnico",
    assigned_to_user_id: "other-user",
    department: "TI",
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(), // 3 dias atrás
    updated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    company_id: "company-3",
    company_name: "Corporação C",
    sla_due_date: new Date(Date.now() - 3600000 * 48).toISOString(),
    first_response_at: new Date(Date.now() - 3600000 * 71).toISOString(),
    resolved_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    sla_status: "ok",
    remote_id: null,
    remote_password: null,
    sla_paused_at: null,
    sla_accumulated_pause_minutes: null,
    contract_id: null,
    asset_id: null,
    metadata: null
  }
];

export const getMockTicketsByStatus = (status?: string | string[]) => {
  if (!status) return MOCK_TICKETS;
  const statusArray = Array.isArray(status) ? status : [status];
  
  if (statusArray.includes('open') && !Array.isArray(status)) {
    return MOCK_TICKETS.filter(t => ['open', 'reopened', 'awaiting-customer', 'awaiting-third-party'].includes(t.status));
  } else if (statusArray.includes('closed') && !Array.isArray(status)) {
    return MOCK_TICKETS.filter(t => ['closed', 'cancelled'].includes(t.status));
  }
  
  return MOCK_TICKETS.filter(t => statusArray.includes(t.status));
};
