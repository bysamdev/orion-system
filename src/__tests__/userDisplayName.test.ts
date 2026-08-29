import { describe, it, expect } from 'vitest';
import {
  isUuid,
  isSystemUser,
  resolveUserDisplayName,
  replaceUserUuidsInText,
  createProfilesMap,
  UserProfileSummary,
} from '@/lib/userDisplayName';

describe('userDisplayName utilities', () => {
  const sampleProfiles: UserProfileSummary[] = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      full_name: 'Maria Silva',
      email: 'maria@empresa.com',
      role: 'technician',
      department: 'Suporte N2',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      full_name: '',
      email: 'joao.semnome@empresa.com',
      role: 'technician',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      full_name: 'Carlos Gestor',
      email: 'carlos@empresa.com',
      role: 'admin',
    },
  ];

  const profilesMap = createProfilesMap(sampleProfiles);

  describe('isUuid', () => {
    it('reconhece UUIDs válidos (v4 e padrão 8-4-4-4-12)', () => {
      expect(isUuid('a0000000-0000-0000-0000-000000000001')).toBe(true);
      expect(isUuid('c83f7a12-89bc-4ef1-9876-123456789abc')).toBe(true);
      expect(isUuid('C83F7A12-89BC-4EF1-9876-123456789ABC')).toBe(true);
    });

    it('rejeita strings que não são UUIDs', () => {
      expect(isUuid('Maria Silva')).toBe(false);
      expect(isUuid('system')).toBe(false);
      expect(isUuid('123')).toBe(false);
      expect(isUuid(null)).toBe(false);
      expect(isUuid(undefined)).toBe(false);
      expect(isUuid('')).toBe(false);
    });
  });

  describe('isSystemUser', () => {
    it('identifica strings de sistema e automação', () => {
      expect(isSystemUser('system')).toBe(true);
      expect(isSystemUser('Sistema')).toBe(true);
      expect(isSystemUser('automation')).toBe(true);
      expect(isSystemUser('bot')).toBe(true);
      expect(isSystemUser('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('retorna false para usuários normais', () => {
      expect(isSystemUser('a0000000-0000-0000-0000-000000000001')).toBe(false);
      expect(isSystemUser('Maria Silva')).toBe(false);
      expect(isSystemUser('')).toBe(false);
      expect(isSystemUser(null)).toBe(false);
    });
  });

  describe('resolveUserDisplayName', () => {
    it('resolve UUID conhecido para o full_name', () => {
      expect(
        resolveUserDisplayName('a0000000-0000-0000-0000-000000000001', profilesMap)
      ).toBe('Maria Silva');
    });

    it('resolve UUID com full_name vazio para o email', () => {
      expect(
        resolveUserDisplayName('a0000000-0000-0000-0000-000000000002', profilesMap)
      ).toBe('joao.semnome@empresa.com');
    });

    it('retorna fallback padrão "Usuário Removido" para UUID desconhecido', () => {
      expect(
        resolveUserDisplayName('f9999999-9999-9999-9999-999999999999', profilesMap)
      ).toBe('Usuário Removido');
    });

    it('respeita fallback customizado para UUID desconhecido', () => {
      expect(
        resolveUserDisplayName('f9999999-9999-9999-9999-999999999999', profilesMap, {
          fallback: 'Técnico removido',
        })
      ).toBe('Técnico removido');
    });

    it('retorna fallback de não atribuído para valores nulos, vazios ou "unassigned"', () => {
      expect(resolveUserDisplayName(null, profilesMap)).toBe('Não atribuído');
      expect(resolveUserDisplayName(undefined, profilesMap)).toBe('Não atribuído');
      expect(resolveUserDisplayName('', profilesMap)).toBe('Não atribuído');
      expect(resolveUserDisplayName('unassigned', profilesMap)).toBe('Não atribuído');
      expect(resolveUserDisplayName('UNASSIGNED', profilesMap)).toBe('Não atribuído');
    });

    it('respeita unassignedFallback customizado', () => {
      expect(
        resolveUserDisplayName('', profilesMap, { unassignedFallback: 'Aguardando Atribuição' })
      ).toBe('Aguardando Atribuição');
    });

    it('retorna "Sistema" para identificadores de automação e robôs', () => {
      expect(resolveUserDisplayName('system', profilesMap)).toBe('Sistema');
      expect(resolveUserDisplayName('automation', profilesMap)).toBe('Sistema');
      expect(resolveUserDisplayName('00000000-0000-0000-0000-000000000000', profilesMap)).toBe('Sistema');
    });

    it('preserva nomes humanos já resolvidos ou literais', () => {
      expect(resolveUserDisplayName('Ana Paula Pereira', profilesMap)).toBe('Ana Paula Pereira');
      expect(resolveUserDisplayName('Suporte N1', profilesMap)).toBe('Suporte N1');
    });

    it('mostra estado de carregamento "…" quando isLoading é true', () => {
      expect(
        resolveUserDisplayName('a0000000-0000-0000-0000-000000000001', new Map(), {
          isLoading: true,
        })
      ).toBe('…');
    });
  });

  describe('replaceUserUuidsInText', () => {
    it('substitui UUIDs embutidos em mensagens de histórico ou log', () => {
      const msg = 'Chamado atribuído para o técnico a0000000-0000-0000-0000-000000000001 via regra VIP.';
      expect(replaceUserUuidsInText(msg, profilesMap)).toBe(
        'Chamado atribuído para o técnico Maria Silva via regra VIP.'
      );
    });

    it('substitui múltiplos UUIDs na mesma mensagem', () => {
      const msg = 'Transferido de a0000000-0000-0000-0000-000000000001 para a0000000-0000-0000-0000-000000000003.';
      expect(replaceUserUuidsInText(msg, profilesMap)).toBe(
        'Transferido de Maria Silva para Carlos Gestor.'
      );
    });

    it('substitui UUID desconhecido por fallback', () => {
      const msg = 'Executado por f9999999-9999-9999-9999-999999999999.';
      expect(replaceUserUuidsInText(msg, profilesMap)).toBe(
        'Executado por Usuário Removido.'
      );
    });

    it('retorna string vazia para texto nulo ou indefinido', () => {
      expect(replaceUserUuidsInText(null, profilesMap)).toBe('');
      expect(replaceUserUuidsInText(undefined, profilesMap)).toBe('');
    });
  });

  describe('createProfilesMap', () => {
    it('cria mapa indexando por case insensitive', () => {
      const map = createProfilesMap([
        { id: '12345678-ABCD-1234-ABCD-1234567890AB', full_name: 'Teste Case' },
      ]);
      expect(map.get('12345678-abcd-1234-abcd-1234567890ab')?.full_name).toBe('Teste Case');
      expect(map.get('12345678-ABCD-1234-ABCD-1234567890AB')?.full_name).toBe('Teste Case');
    });

    it('lida com array vazio ou indefinido sem lançar erro', () => {
      expect(createProfilesMap(undefined).size).toBe(0);
      expect(createProfilesMap([]).size).toBe(0);
    });
  });
});
