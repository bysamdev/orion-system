#!/usr/bin/env node
// Catraca de lint: o repositório tem 207 erros de ESLint herdados (200 deles
// @typescript-eslint/no-explicit-any). Gatear em zero reprovaria todo PR e a
// CI viraria ruído; não gatear deixa a dívida crescer sem ninguém ver.
//
// Então o gate é comparativo: falha se o total SUBIR. Quando alguém corrigir
// erros, o script avisa para baixar a linha de base — é isso que faz a
// catraca só girar para um lado.
//
// Uso: node scripts/lint-ratchet.mjs

import { execFileSync } from 'node:child_process';

const BASELINE = 203;

let raw;
try {
  raw = execFileSync('npx', ['eslint', '.', '-f', 'json'], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // ESLint sai com código 1 quando há erros — é o caso esperado aqui, e o
  // JSON vem no stdout normalmente. Só é falha de verdade se não houver saída.
  if (!err.stdout) {
    console.error('Falha ao executar o ESLint:', err.message);
    process.exit(2);
  }
  raw = err.stdout;
}

const results = JSON.parse(raw);
const errors = results.reduce((acc, f) => acc + f.errorCount, 0);
const warnings = results.reduce((acc, f) => acc + f.warningCount, 0);

console.log(`ESLint: ${errors} erros, ${warnings} avisos (linha de base: ${BASELINE} erros)`);

if (errors > BASELINE) {
  const novos = errors - BASELINE;
  console.error(
    `\n✗ ${novos} erro(s) de lint a mais que a linha de base.\n` +
      `  Corrija os erros introduzidos por esta mudança.\n` +
      `  Os erros herdados não bloqueiam — só os novos.`
  );

  const porRegra = new Map();
  for (const f of results) {
    for (const m of f.messages) {
      if (m.severity !== 2) continue;
      porRegra.set(m.ruleId, (porRegra.get(m.ruleId) ?? 0) + 1);
    }
  }
  console.error('\n  Erros por regra:');
  for (const [regra, n] of [...porRegra.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.error(`    ${n.toString().padStart(4)}  ${regra}`);
  }
  process.exit(1);
}

if (errors < BASELINE) {
  console.log(
    `\n✓ ${BASELINE - errors} erro(s) a menos que a linha de base.\n` +
      `  Baixe BASELINE para ${errors} em scripts/lint-ratchet.mjs para travar o ganho.`
  );
}
