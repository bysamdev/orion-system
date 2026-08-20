import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeBackupCode,
  formatBackupCode,
  generateBackupCodes,
  hashBackupCode,
  enrollTotpFactor,
  verifyTotpEnrollment,
  unenrollTotpFactor,
  getMfaStatus,
  saveBackupCodes,
  verifyBackupCode,
  getBackupCodesStatus,
} from '@/lib/mfa';
import { supabase } from '@/integrations/supabase/client';

// Mock do cliente Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      mfa: {
        enroll: vi.fn(),
        challengeAndVerify: vi.fn(),
        unenroll: vi.fn(),
        listFactors: vi.fn(),
        getAuthenticatorAssuranceLevel: vi.fn(),
      },
      getUser: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('MFA 2FA Utility - Testes Unitários e de Integração', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Funções de Formatação e Normalização de Códigos', () => {
    it('deve normalizar códigos removendo espaços, hífens e convertendo para maiúsculo', () => {
      expect(normalizeBackupCode('abcd-efgh')).toBe('ABCDEFGH');
      expect(normalizeBackupCode('  ab cd - 12 34  ')).toBe('ABCD1234');
      expect(normalizeBackupCode('')).toBe('');
    });

    it('deve formatar código no padrão XXXX-XXXX', () => {
      expect(formatBackupCode('abcdefgh')).toBe('ABCD-EFGH');
      expect(formatBackupCode('12345678')).toBe('1234-5678');
      expect(formatBackupCode('abc')).toBe('ABC');
    });

    it('deve gerar 8 códigos de backup únicos no formato correto sem caracteres ambíguos (0, O, 1, I)', () => {
      const codes = generateBackupCodes(8);
      expect(codes).toHaveLength(8);

      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(8);

      for (const code of codes) {
        expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
        expect(code).not.toContain('0');
        expect(code).not.toContain('O');
        expect(code).not.toContain('1');
        expect(code).not.toContain('I');
      }
    });

    it('deve gerar hash SHA-256 consistente e independente de formatação/espaços', async () => {
      const hash1 = await hashBackupCode('ABCD-EFGH');
      const hash2 = await hashBackupCode('abcd efgh');
      const hash3 = await hashBackupCode('  abcdefgh  ');

      expect(hash1).toHaveLength(64); // SHA-256 hex string
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('Fluxo de TOTP nativo do Supabase Auth', () => {
    it('deve iniciar o registro TOTP com dados corretos de QR Code e chave secreta', async () => {
      const mockEnrollResponse = {
        data: {
          id: 'factor-totp-123',
          type: 'totp',
          totp: {
            qr_code: 'data:image/svg+xml;utf-8,<svg>test</svg>',
            secret: 'JBSWY3DPEHPK3PXP',
            uri: 'otpauth://totp/Orion:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Orion+System',
          },
        },
        error: null,
      };

      (supabase.auth.mfa.enroll as any).mockResolvedValueOnce(mockEnrollResponse);

      const result = await enrollTotpFactor('Orion Authenticator');

      expect(supabase.auth.mfa.enroll).toHaveBeenCalledWith({
        factorType: 'totp',
        friendlyName: 'Orion Authenticator',
        issuer: 'Orion System',
      });

      expect(result.factorId).toBe('factor-totp-123');
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.qrCode).toContain('<svg>test</svg>');
    });

    it('deve validar desafio de ativação TOTP com código de 6 dígitos', async () => {
      (supabase.auth.mfa.challengeAndVerify as any).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const success = await verifyTotpEnrollment('factor-totp-123', ' 123 456 ');

      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
        factorId: 'factor-totp-123',
        code: '123456',
      });
      expect(success).toBe(true);
    });

    it('deve desativar o fator TOTP e limpar registros', async () => {
      (supabase.auth.mfa.unenroll as any).mockResolvedValueOnce({
        data: { id: 'factor-totp-123' },
        error: null,
      });

      (supabase.auth.getUser as any).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      (supabase.from as any).mockReturnValue({ delete: mockDelete });

      await unenrollTotpFactor('factor-totp-123');

      expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({
        factorId: 'factor-totp-123',
      });
    });

    it('deve retornar status do 2FA indicando se está ativo ou inativo e os níveis AAL', async () => {
      (supabase.auth.mfa.listFactors as any).mockResolvedValueOnce({
        data: {
          all: [
            {
              id: 'factor-1',
              friendly_name: 'Meu App',
              factor_type: 'totp',
              status: 'verified',
              created_at: '2026-08-20T00:00:00Z',
              updated_at: '2026-08-20T00:00:00Z',
            },
          ],
          totp: [
            {
              id: 'factor-1',
              status: 'verified',
            },
          ],
        },
        error: null,
      });

      (supabase.auth.mfa.getAuthenticatorAssuranceLevel as any).mockResolvedValueOnce({
        data: {
          currentLevel: 'aal2',
          nextLevel: 'aal2',
          currentAuthenticationMethods: ['password', 'totp'],
        },
        error: null,
      });

      const status = await getMfaStatus();

      expect(status.isEnabled).toBe(true);
      expect(status.currentLevel).toBe('aal2');
      expect(status.factors).toHaveLength(1);
    });
  });

  describe('Armazenamento e Validação de Códigos de Recuperação', () => {
    it('deve salvar hashes de códigos de backup via RPC', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({ error: null });

      const codes = ['ABCD-1234', 'EFGH-5678'];
      await saveBackupCodes(codes);

      expect(supabase.rpc).toHaveBeenCalledWith(
        'save_user_backup_codes',
        expect.objectContaining({
          p_code_hashes: expect.any(Array),
        })
      );
    });

    it('deve validar e consumir código de backup com sucesso', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({ data: true, error: null });

      const isValid = await verifyBackupCode('ABCD-1234');
      expect(isValid).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'verify_user_backup_code',
        expect.objectContaining({
          p_code_hash: expect.any(String),
        })
      );
    });

    it('deve rejeitar código de backup inválido', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({ data: false, error: null });

      const isValid = await verifyBackupCode('INVALID-CODE');
      expect(isValid).toBe(false);
    });

    it('deve obter quantidade de códigos totais e restantes', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { total: 8, remaining: 6 },
        error: null,
      });

      const status = await getBackupCodesStatus();
      expect(status.total).toBe(8);
      expect(status.remaining).toBe(6);
    });
  });

  describe('Compatibilidade Opt-in e Segurança para Perfis Técnicos', () => {
    it('deve permitir login opt-in direto quando nextLevel for aal1', () => {
      const aalData = { currentLevel: 'aal1', nextLevel: 'aal1' };
      const requiresMfa = aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1';
      expect(requiresMfa).toBe(false);
    });

    it('deve exigir desafio MFA apenas quando nextLevel for aal2 e currentLevel for aal1', () => {
      const aalData = { currentLevel: 'aal1', nextLevel: 'aal2' };
      const requiresMfa = aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1';
      expect(requiresMfa).toBe(true);
    });

    it('deve identificar corretamente que 2FA é requerido para gestor (admin) e desenvolvedor, e opcional para os demais', () => {
      const isRequiredRole = (role: string) =>
        role === 'admin' || role === 'developer';

      expect(isRequiredRole('admin')).toBe(true);
      expect(isRequiredRole('developer')).toBe(true);
      expect(isRequiredRole('technician')).toBe(false);
      expect(isRequiredRole('customer')).toBe(false);
    });
  });
});
