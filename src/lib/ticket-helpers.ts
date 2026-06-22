import { supabaseRead } from '@/integrations/supabase/read-client';

/**
 * Enriches a list of tickets with company_name by batch-fetching
 * profiles and companies. Replaces 5 duplicated implementations.
 */
export async function enrichTicketsWithCompany<T extends { user_id?: string; sla_due_date?: string | null; created_at?: string | null; sla_status?: string | null }>(
  tickets: T[]
): Promise<(T & { company_name: string | null })[]> {
  if (!tickets || tickets.length === 0) return [];

  const userIds = [...new Set(tickets.map(t => t.user_id).filter((id): id is string => Boolean(id)))];
  if (userIds.length === 0) return tickets.map(t => ({ ...t, company_name: null }));

  // Batch fetch profiles and companies in parallel where possible
  const { data: profiles } = await supabaseRead
    .from('profiles')
    .select('id, full_name, company_id')
    .in('id', userIds);

  const companyIds = [...new Set(profiles?.map(p => p.company_id).filter(Boolean) || [])];

  const { data: companies } = companyIds.length > 0
    ? await supabaseRead.from('companies').select('id, name').in('id', companyIds)
    : { data: [] };

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
  const companyMap = new Map((companies || []).map(c => [c.id, c] as [string, { id: string; name: string }]));

  return tickets.map(ticket => {
    const profile = ticket.user_id ? profileMap.get(ticket.user_id) : null;
    const company = profile?.company_id ? companyMap.get(profile.company_id) : null;
    const dynamicSlaStatus = ticket.sla_due_date ? calculateSlaStatus(ticket.sla_due_date, ticket.created_at) : ticket.sla_status;
    return { ...ticket, company_name: company?.name || null, sla_status: dynamicSlaStatus };
  });
}

/**
 * Keyword map for auto-suggesting ticket category based on title/description.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  hardware: ['impressora', 'toner', 'monitor', 'teclado', 'mouse', 'computador', 'notebook', 'pc', 'hd', 'ssd', 'memória', 'ram', 'placa', 'fonte', 'cabo', 'usb', 'scanner'],
  email: ['email', 'e-mail', 'outlook', 'smtp', 'imap', 'pop3', 'exchange', 'spam', 'caixa de entrada', 'thunderbird'],
  rede: ['internet', 'wifi', 'wi-fi', 'rede', 'vpn', 'firewall', 'switch', 'roteador', 'dns', 'ip', 'ping', 'proxy', 'cabeamento'],
  erp: ['nota fiscal', 'boleto', 'nf-e', 'erp', 'fiscal', 'estoque', 'financeiro', 'contábil', 'sefaz', 'danfe', 'xml', 'certificado digital'],
  software: ['instalar', 'atualizar', 'programa', 'sistema', 'windows', 'licença', 'antivírus', 'driver', 'lento', 'travando', 'erro', 'crash', 'blue screen', 'tela azul'],
};

/**
 * Suggests a ticket category based on text content.
 * Returns the category ID or null if no strong match.
 */
export function suggestCategory(text: string): string | null {
  if (!text || text.length < 3) return null;

  const lower = text.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

/**
 * Category display names for the suggestion badge.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  hardware: 'Hardware',
  email: 'E-mail',
  rede: 'Rede',
  erp: 'ERP',
  software: 'Software',
  outros: 'Outros',
};

/**
 * Calcula o status do SLA de forma dinâmica baseado na data atual.
 * - VENCIDO (breached): now > vencimento
 * - CRÍTICO (attention): <= 15% do tempo restante
 * - ATENÇÃO (warning): <= 40% do tempo restante
 * - NO PRAZO (ok): > 40% do tempo restante
 */
export function calculateSlaStatus(slaDueDate: string | null, createdAt?: string | null): 'ok' | 'warning' | 'attention' | 'breached' | null {
  if (!slaDueDate) return null;
  
  const now = new Date();
  const dueDate = new Date(slaDueDate);
  
  if (now > dueDate) {
    return 'breached';
  }
  
  let slaPolicyMs = 0;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    slaPolicyMs = dueDate.getTime() - createdDate.getTime();
  }
  
  if (slaPolicyMs <= 0) {
    // Default to 24h if no createdAt or invalid duration
    slaPolicyMs = 24 * 60 * 60 * 1000;
  }
  
  const msRemaining = dueDate.getTime() - now.getTime();
  const percentualRestante = (msRemaining / slaPolicyMs) * 100;
  
  if (percentualRestante <= 15) return 'attention';
  if (percentualRestante <= 40) return 'warning';
  
  return 'ok';
}
