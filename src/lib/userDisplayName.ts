/**
 * Utilitário centralizado para resolução e exibição de identidades de usuários.
 *
 * Converte UUIDs brutos de banco de dados (ex: 'c83f7a12-89bc-4ef1-9876-123456789abc')
 * em nomes legíveis de técnicos e colaboradores ('Maria Silva', 'João Souza'),
 * com fallback gracioso para "Sistema", "Usuário Removido" ou "Não atribuído".
 */

export interface UserProfileSummary {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
  company_id?: string | null;
}

export type ProfilesMap = Map<string, UserProfileSummary> | Record<string, UserProfileSummary>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMBEDDED_UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const SYSTEM_IDENTIFIERS = new Set([
  'system',
  'sistema',
  'automation',
  'automação',
  'bot',
  'cron',
  'auto',
  '00000000-0000-0000-0000-000000000000',
]);

/**
 * Verifica se um valor é uma string no formato UUID.
 */
export function isUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * Verifica se um identificador representa o sistema / automação.
 */
export function isSystemUser(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return SYSTEM_IDENTIFIERS.has(val.trim().toLowerCase());
}

/**
 * Normaliza um Map ou Record de perfis para facilitar busca por chave (case-insensitive para UUIDs).
 */
function getProfileFromMap(
  profilesMap: ProfilesMap | undefined,
  id: string
): UserProfileSummary | undefined {
  if (!profilesMap) return undefined;
  
  if (profilesMap instanceof Map) {
    return profilesMap.get(id) || profilesMap.get(id.toLowerCase());
  }

  return (profilesMap as Record<string, UserProfileSummary>)[id] ||
         (profilesMap as Record<string, UserProfileSummary>)[id.toLowerCase()];
}

export interface ResolveUserOptions {
  /** Texto para quando o usuário/técnico não for encontrado. Default: 'Usuário Removido' */
  fallback?: string;
  /** Texto para valores vazios, indefinidos ou 'unassigned'. Default: 'Não atribuído' */
  unassignedFallback?: string;
  /** Se o carregamento ainda está em andamento, retorna '…' em vez de disparar fallback prematuro */
  isLoading?: boolean;
}

/**
 * Resolve um ID (ou nome já legível) para o nome de exibição do usuário.
 * 
 * Regras:
 * 1. Se isLoading: retorna '…'.
 * 2. Se nulo/vazio/'unassigned': retorna unassignedFallback (default: 'Não atribuído').
 * 3. Se identificador de sistema: retorna 'Sistema'.
 * 4. Se presente no mapa de perfis: retorna full_name ou email ou fallback.
 * 5. Se for UUID mas não encontrado no mapa: retorna fallback (default: 'Usuário Removido').
 * 6. Se NÃO for UUID (já é um nome legível como "Carlos Silva"): preserva o nome como está.
 */
export function resolveUserDisplayName(
  idOrName: string | null | undefined,
  profilesMap?: ProfilesMap,
  options: ResolveUserOptions = {}
): string {
  const {
    fallback = 'Usuário Removido',
    unassignedFallback = 'Não atribuído',
    isLoading = false,
  } = options;

  if (isLoading) return '…';

  if (!idOrName || idOrName.trim() === '' || idOrName.trim().toLowerCase() === 'unassigned') {
    return unassignedFallback;
  }

  const trimmed = idOrName.trim();

  if (isSystemUser(trimmed)) {
    return 'Sistema';
  }

  // Tenta encontrar no mapa de perfis
  const profile = getProfileFromMap(profilesMap, trimmed);
  if (profile) {
    if (profile.full_name && profile.full_name.trim() !== '') {
      return profile.full_name.trim();
    }
    if (profile.email && profile.email.trim() !== '') {
      return profile.email.trim();
    }
    return fallback;
  }

  // Se é um UUID mas não está no mapa, aplica o fallback para evitar vazar UUID
  if (isUuid(trimmed)) {
    return fallback;
  }

  // Se não é UUID e não é nulo, é um nome legível já salvo (ex.: 'Maria Silva')
  return trimmed;
}

/**
 * Substitui UUIDs contidos dentro de um texto livre (ex: logs de auditoria, notificações)
 * pelos nomes resolvidos correspondentes.
 */
export function replaceUserUuidsInText(
  text: string | null | undefined,
  profilesMap?: ProfilesMap,
  fallback: string = 'Usuário Removido'
): string {
  if (!text) return '';

  return text.replace(EMBEDDED_UUID_REGEX, (matchedUuid) => {
    if (isSystemUser(matchedUuid)) return 'Sistema';
    return resolveUserDisplayName(matchedUuid, profilesMap, { fallback });
  });
}

/**
 * Helper para converter um array de perfis do Supabase em um Map indexado por ID.
 */
export function createProfilesMap(
  profiles: Array<UserProfileSummary | null | undefined> | undefined
): Map<string, UserProfileSummary> {
  const map = new Map<string, UserProfileSummary>();
  if (!profiles) return map;

  for (const p of profiles) {
    if (p && p.id) {
      map.set(p.id, p);
      map.set(p.id.toLowerCase(), p);
    }
  }

  return map;
}
