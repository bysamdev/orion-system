#!/usr/bin/env node
// Checagem barata de sanidade das migrations, para rodar na CI sem precisar
// de um Postgres.
//
// Não substitui o replay completo (que exige a CLI do Supabase: 102 das 190
// migrations dependem de schemas auth/vault/cron/storage e não rodam num
// Postgres puro). Pega só a classe de erro que é silenciosa no editor e cara
// em produção: dois arquivos com o mesmo timestamp, em que a ordem de
// aplicação passa a depender de detalhe de ordenação e pode divergir entre
// um banco e outro.
//
// Uso: node scripts/check-migrations.mjs

import { readdirSync } from 'node:fs';
import path from 'node:path';

const DIR = 'supabase/migrations';
// O sufixo é livre de propósito: as migrations antigas geradas pelo painel do
// Supabase usam UUID no lugar do nome descritivo, e elas continuam sendo
// timestamps válidos para efeito de ordenação. Só o prefixo importa aqui.
const PADRAO = /^(\d{14})_.+\.sql$/;

const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const problemas = [];
const porTimestamp = new Map();

for (const arquivo of arquivos) {
  const m = PADRAO.exec(arquivo);
  if (!m) {
    // Migrations antigas geradas pelo painel do Supabase usam nome com UUID.
    // Só avisamos para não reprovar histórico que já está aplicado.
    console.warn(`aviso: fora do padrão <timestamp>_<nome>.sql: ${arquivo}`);
    continue;
  }
  const ts = m[1];
  if (!porTimestamp.has(ts)) porTimestamp.set(ts, []);
  porTimestamp.get(ts).push(arquivo);
}

for (const [ts, lista] of porTimestamp) {
  if (lista.length > 1) {
    problemas.push(`timestamp duplicado ${ts}:\n    ${lista.join('\n    ')}`);
  }
}

console.log(`Migrations: ${arquivos.length} arquivos, ${porTimestamp.size} timestamps únicos`);

if (problemas.length > 0) {
  console.error('\n✗ Problemas encontrados:\n');
  for (const p of problemas) console.error(`  ${p}`);
  console.error(
    '\n  Renomeie a migration mais nova para um timestamp posterior:\n' +
      '  com timestamps iguais a ordem de aplicação fica indefinida.'
  );
  process.exit(1);
}

console.log('✓ Nenhum timestamp duplicado.');
