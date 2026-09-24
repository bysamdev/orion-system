// Regras puras de excluir-anexo, testadas com vitest.

export const BUCKET = 'ticket-files';

// file_url novo já é o caminho no bucket ("<ticket>/<arquivo>"); os antigos
// eram a URL inteira do Storage. Mesmo critério de getStoragePath no hook.
export function caminhoNoBucket(fileUrl: string): string | null {
  if (!fileUrl) return null;
  if (!/^https?:\/\//i.test(fileUrl)) return fileUrl.replace(/^\/+/, '');
  try {
    const marcador = `/${BUCKET}/`;
    const pathname = decodeURIComponent(new URL(fileUrl).pathname);
    const i = pathname.indexOf(marcador);
    return i === -1 ? null : pathname.substring(i + marcador.length);
  } catch {
    return null;
  }
}

// Storage devolve "not found" quando o objeto já não existe: para exclusão,
// isso é sucesso (idempotente).
export const naoEncontrado = (msg: string | undefined) => /not.?found|does not exist|404/i.test(msg ?? '');

// Descarte só aceita "<uuid do chamado>/<arquivo>", sem subpastas: impede
// apontar para arquivo fora da pasta de um chamado.
export function caminhoDeDescarteValido(caminho: string | null): caminho is string {
  return !!caminho && /^[0-9a-f-]{36}\/[^/]+$/i.test(caminho);
}

export const JANELA_DE_DESCARTE_MS = 15 * 60 * 1000;

// Descarte é para o upload que acabou de falhar, não para limpar arquivo antigo.
export function envioRecente(criadoEm: string | null | undefined, agora = Date.now()): boolean {
  const t = criadoEm ? new Date(criadoEm).getTime() : 0;
  return !!t && agora - t <= JANELA_DE_DESCARTE_MS;
}

export const idDeAnexoValido = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
