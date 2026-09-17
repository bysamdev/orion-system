import { describe, it, expect } from 'vitest';
import { agruparUsuariosPorEmpresa, SEM_EMPRESA } from './usuariosPorEmpresa';

const u = (company_name: string, role = 'customer', email = 'x@y.z') => ({
  company_name,
  role,
  email,
});

describe('agruparUsuariosPorEmpresa', () => {
  it('junta os usuários da mesma empresa num grupo só', () => {
    const grupos = agruparUsuariosPorEmpresa([
      u('Acme', 'customer', 'a@acme.com'),
      u('Beta'),
      u('Acme', 'admin', 'b@acme.com'),
    ]);

    expect(grupos.map((g) => g.empresa)).toEqual(['Acme', 'Beta']);
    expect(grupos[0].usuarios.map((x) => x.email)).toEqual(['a@acme.com', 'b@acme.com']);
  });

  it('ordena as empresas alfabeticamente respeitando acento', () => {
    const grupos = agruparUsuariosPorEmpresa([u('Zeta'), u('Ática'), u('Beta')]);

    expect(grupos.map((g) => g.empresa)).toEqual(['Ática', 'Beta', 'Zeta']);
  });

  it('empurra "Sem empresa" para o fim, mesmo vindo primeiro', () => {
    // É o balde de perfis órfãos (conta-fantasma de máquina cai aqui), não
    // uma empresa — não pode abrir a lista.
    const grupos = agruparUsuariosPorEmpresa([u(SEM_EMPRESA), u('Acme'), u('Zeta')]);

    expect(grupos.map((g) => g.empresa)).toEqual(['Acme', 'Zeta', SEM_EMPRESA]);
  });

  it('trata company_name vazio como "Sem empresa"', () => {
    const grupos = agruparUsuariosPorEmpresa([u('')]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].empresa).toBe(SEM_EMPRESA);
  });

  it('conta como equipe apenas os papéis globais', () => {
    const grupos = agruparUsuariosPorEmpresa([
      u('Acme', 'admin'),
      u('Acme', 'technician'),
      u('Acme', 'developer'),
      u('Acme', 'customer'),
    ]);

    expect(grupos[0].usuarios).toHaveLength(4);
    expect(grupos[0].equipe).toBe(3);
  });

  it('devolve lista vazia para entrada vazia, nula ou indefinida', () => {
    expect(agruparUsuariosPorEmpresa([])).toEqual([]);
    expect(agruparUsuariosPorEmpresa(null)).toEqual([]);
    expect(agruparUsuariosPorEmpresa(undefined)).toEqual([]);
  });
});
