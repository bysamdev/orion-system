import { supabaseRead } from '@/integrations/supabase/read-client';

/**
 * Enriches a list of tickets with company_name by batch-fetching
 * profiles and companies. Replaces 5 duplicated implementations.
 */
export async function enrichTicketsWithCompany<T extends { user_id?: string }>(
  tickets: T[]
): Promise<(T & { company_name: string | null })[]> {
  if (!tickets || tickets.length === 0) return [];

  const userIds = [...new Set(tickets.map(t => (t as any).user_id).filter(Boolean))];
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
  const companyMap = new Map((companies || []).map((c: any) => [c.id, c] as [string, any]));

  return tickets.map(ticket => {
    const profile = profileMap.get((ticket as any).user_id);
    const company = profile ? companyMap.get(profile.company_id) : null;
    const dynamicSlaStatus = (ticket as any).sla_due_date ? calculateSlaStatus((ticket as any).sla_due_date) : (ticket as any).sla_status;
    return { ...ticket, company_name: (company as any)?.name || null, sla_status: dynamicSlaStatus };
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
 * - CRÍTICO (attention): now > vencimento - 24h
 * - NO PRAZO (ok): now <= vencimento
 */
export function calculateSlaStatus(slaDueDate: string | null): 'ok' | 'attention' | 'breached' | null {
  if (!slaDueDate) return null;
  
  const now = new Date();
  const dueDate = new Date(slaDueDate);
  const criticalDate = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000); // dueDate - 24h

  if (now > dueDate) {
    return 'breached';
  } else if (now > criticalDate) {
    return 'attention';
  } else {
    return 'ok';
  }
}
