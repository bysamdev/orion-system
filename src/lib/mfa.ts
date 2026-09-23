import { supabase } from '@/integrations/supabase/client';

// Códigos de recuperação do 2FA foram retirados em 23/09/2026 (ORN-BUG-11):
// a tabela e as funções nunca existiram no banco. Quem perde o autenticador
// pede a um administrador para remover o fator pelo painel do Supabase.

export interface TotpEnrollmentData {
  factorId: string;
  type: 'totp';
  qrCode: string; // SVG or data URL
  secret: string;
  uri: string;
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
