import { supabase } from '@/integrations/supabase/client';

export interface TotpEnrollmentData {
  factorId: string;
  type: 'totp';
  qrCode: string; // SVG or data URL
  secret: string;
  uri: string;
}

export interface BackupCodesStatus {
  total: number;
  remaining: number;
}

export interface MfaStatus {
  isEnabled: boolean;
  factors: Array<{
    id: string;
    friendlyName?: string;
    factorType: string;
    status: 'verified' | 'unverified';
    createdAt: string;
    updatedAt: string;
  }>;
  currentLevel: 'aal1' | 'aal2';
  nextLevel: 'aal1' | 'aal2';
}

/**
 * Normaliza um código de backup removendo espaços, hífens e passando para caixa alta.
 */
export function normalizeBackupCode(code: string): string {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Formata um código de backup puro (8 caracteres) no padrão amigável XXXX-XXXX.
 */
export function formatBackupCode(code: string): string {
  const clean = normalizeBackupCode(code);
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

/**
 * Gera um hash SHA-256 de um código de backup (compatível com Browser e Node.js).
 */
export async function hashBackupCode(code: string): Promise<string> {
  const normalized = normalizeBackupCode(code);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback se Web Crypto não estiver disponível (ex: ambientes antigos)
  throw new Error('Ambiente de criptografia seguro (Web Crypto API) não disponível.');
}

/**
 * Gera um conjunto de códigos de backup aleatórios, seguros e sem caracteres confusos (0, O, 1, I).
 */
export function generateBackupCodes(count: number = 8): string[] {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    let raw = '';
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const randomBytes = new Uint8Array(8);
      globalThis.crypto.getRandomValues(randomBytes);
      for (let j = 0; j < 8; j++) {
        raw += charset[randomBytes[j] % charset.length];
      }
    } else {
      for (let j = 0; j < 8; j++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        raw += charset[randomIndex];
      }
    }
    codes.push(formatBackupCode(raw));
  }

  return codes;
}

/**
 * Inicia o fluxo de registro do fator TOTP no Supabase Auth.
 */
export async function enrollTotpFactor(friendlyName: string = 'Orion Authenticator'): Promise<TotpEnrollmentData> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
    issuer: 'Orion System',
  });

  if (error) {
    throw error;
  }

  if (!data || !data.totp) {
    throw new Error('Falha ao iniciar configuração do autenticador TOTP.');
  }

  return {
    factorId: data.id,
    type: 'totp',
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/**
 * Valida o desafio e ativa o fator TOTP recém-cadastrado.
 */
export async function verifyTotpEnrollment(factorId: string, code: string): Promise<boolean> {
  const cleanCode = code.trim().replace(/\s+/g, '');
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: cleanCode,
  });

  if (error) {
    throw error;
  }

  return !!data;
}

/**
 * Desativa/remove um fator de autenticação 2FA.
 */
export async function unenrollTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({
    factorId,
  });

  if (error) {
    throw error;
  }

  // Remove também quaisquer códigos de backup associados
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.from('user_backup_codes' as any).delete().eq('user_id', user.id);
    }
  } catch (err) {
    console.warn('[MFA] Erro ao limpar códigos de backup ao desativar 2FA:', err);
  }
}

/**
 * Obtém todos os fatores cadastrados e o status de garantia de autenticação (AAL).
 */
export async function getMfaStatus(): Promise<MfaStatus> {
  const [factorsResponse, aalResponse] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (factorsResponse.error) {
    throw factorsResponse.error;
  }
  if (aalResponse.error) {
    throw aalResponse.error;
  }

  const allFactors = factorsResponse.data?.all || [];
  const verifiedFactors = factorsResponse.data?.totp?.filter((f) => f.status === 'verified') || [];

  const factors = allFactors.map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name,
    factorType: f.factor_type,
    status: f.status as 'verified' | 'unverified',
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));

  return {
    isEnabled: verifiedFactors.length > 0,
    factors,
    currentLevel: ((aalResponse.data?.currentLevel as unknown) as 'aal1' | 'aal2') || 'aal1',
    nextLevel: ((aalResponse.data?.nextLevel as unknown) as 'aal1' | 'aal2') || 'aal1',
  };
}

/**
 * Salva no banco de dados os hashes dos códigos de backup gerados.
 */
export async function saveBackupCodes(codes: string[]): Promise<void> {
  const hashes = await Promise.all(codes.map((code) => hashBackupCode(code)));

  // Tenta via RPC dedicada
  const { error: rpcError } = await supabase.rpc('save_user_backup_codes' as any, {
    p_code_hashes: hashes,
  });

  if (rpcError) {
    console.warn('[MFA] Falha ao salvar via RPC save_user_backup_codes, tentando inserção direta:', rpcError);
    
    // Fallback: inserção direta com verificação de usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) throw new Error('Usuário não autenticado para salvar códigos de backup.');

    await supabase.from('user_backup_codes' as any).delete().eq('user_id', user.id);

    const rows = hashes.map((h) => ({
      user_id: user.id,
      code_hash: h,
    }));

    const { error: insertError } = await supabase.from('user_backup_codes' as any).insert(rows);
    if (insertError) {
      throw insertError;
    }
  }
}

/**
 * Verifica e consome um código de backup durante o login ou recuperação.
 */
export async function verifyBackupCode(code: string): Promise<boolean> {
  const hash = await hashBackupCode(code);

  // Tenta via RPC segura
  const { data, error } = await supabase.rpc('verify_user_backup_code' as any, {
    p_code_hash: hash,
  });

  if (!error && typeof data === 'boolean') {
    return data;
  }

  // Fallback caso RPC não exista ainda no banco remoto
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return false;

  const { data: records, error: queryError } = await supabase
    .from('user_backup_codes' as any)
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', hash)
    .is('used_at', null)
    .limit(1);

  if (queryError || !records || records.length === 0) {
    return false;
  }

  const recordId = (records as any[])[0]?.id;
  const { error: updateError } = await supabase
    .from('user_backup_codes' as any)
    .update({ used_at: new Date().toISOString() })
    .eq('id', recordId);

  return !updateError;
}

/**
 * Obtém a quantidade total e restante de códigos de backup do usuário.
 */
export async function getBackupCodesStatus(): Promise<BackupCodesStatus> {
  const { data, error } = await supabase.rpc('get_backup_codes_status' as any);

  if (!error && data && typeof data === 'object') {
    return {
      total: Number((data as any).total || 0),
      remaining: Number((data as any).remaining || 0),
    };
  }

  // Fallback: contagem direta
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { total: 0, remaining: 0 };

  const { data: allCodes } = await supabase
    .from('user_backup_codes' as any)
    .select('id, used_at')
    .eq('user_id', user.id);

  if (!allCodes) return { total: 0, remaining: 0 };

  const total = allCodes.length;
  const remaining = allCodes.filter((c: any) => !c.used_at).length;

  return { total, remaining };
}

/**
 * Cria e dispara o download de um arquivo .txt contendo os códigos de backup.
 */
export function downloadBackupCodesAsText(codes: string[], userEmail?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const content = [
    '======================================================',
    '       ORION SYSTEM - CÓDIGOS DE RECUPERAÇÃO 2FA      ',
    '======================================================',
    `Usuário: ${userEmail || 'Conta Orion'}`,
    `Data de Emissão: ${new Date().toLocaleString('pt-BR')}`,
    '',
    'AVISO IMPORTANTE:',
    '- Cada código de recuperação só pode ser usado UMA ÚNICA VEZ.',
    '- Guarde este arquivo em local protegido e seguro.',
    '- Se você perder o acesso ao autenticador, use um destes códigos.',
    '',
    '------------------------------------------------------',
    'CÓDIGOS DE BACKUP:',
    '------------------------------------------------------',
    ...codes.map((c, i) => `${(i + 1).toString().padStart(2, '0')}.  ${c}`),
    '------------------------------------------------------',
    '',
    'Após usar um código, recomendamos gerar um novo conjunto de códigos',
    'na aba de Segurança das configurações da sua conta.',
    '======================================================',
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orion-backup-codes-${timestamp.substring(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
