import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERGUNTAS_POR_CATEGORIA } from './perguntasPorCategoria';

// O banco recusa chamado sem as respostas obrigatórias comparando pelo rótulo
// (perguntas_obrigatorias_da_categoria). Mudou uma pergunta aqui, crie uma
// migration nova com a lista atualizada; senão o formulário para de abrir chamado.
describe('perguntas obrigatórias no banco', () => {
  it('a última migration de perguntas_obrigatorias_da_categoria bate com o formulário', () => {
    const pasta = join(__dirname, '..', '..', 'supabase', 'migrations');
    const ultima = readdirSync(pasta)
      .filter(f => readFileSync(join(pasta, f), 'utf8').includes('FUNCTION public.perguntas_obrigatorias_da_categoria'))
      .sort()
      .at(-1)!;
    const sql = readFileSync(join(pasta, ultima), 'utf8');
    for (const [categoria, perguntas] of Object.entries(PERGUNTAS_POR_CATEGORIA)) {
      const esperado = perguntas.filter(p => p.obrigatoria).map(p => `'${p.rotulo.replace(/'/g, "''")}'`).join(', ');
      expect(sql, `categoria ${categoria}`).toContain(`WHEN '${categoria}' THEN ARRAY[${esperado}]`);
    }
  });
});
