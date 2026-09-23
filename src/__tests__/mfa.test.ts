import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Os mocks recebem objetos parciais; a tipagem estrita do Supabase não ajuda aqui.
const comoMock = (fn: unknown) => fn as Mock;
import {
  enrollTotpFactor,
  verifyTotpEnrollment,
  unenrollTotpFactor,
  getMfaStatus,
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

      comoMock(supabase.auth.mfa.enroll).mockResolvedValueOnce(mockEnrollResponse);

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
      comoMock(supabase.auth.mfa.challengeAndVerify).mockResolvedValueOnce({
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

    it('deve desativar o fator TOTP', async () => {
      comoMock(supabase.auth.mfa.unenroll).mockResolvedValueOnce({
        data: { id: 'factor-totp-123' },
        error: null,
      });

      await unenrollTotpFactor('factor-totp-123');

      expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({
        factorId: 'factor-totp-123',
      });
    });

    it('deve retornar status do 2FA indicando se está ativo ou inativo e os níveis AAL', async () => {
      comoMock(supabase.auth.mfa.listFactors).mockResolvedValueOnce({
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

      comoMock(supabase.auth.mfa.getAuthenticatorAssuranceLevel).mockResolvedValueOnce({
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
