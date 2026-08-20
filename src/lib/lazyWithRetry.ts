import { lazy, ComponentType } from 'react';

/**
 * Carrega componentes dinamicamente com retentativas automáticas em caso de falha de rede
 * ou de chunk desatualizado pós-deploy (Failed to fetch dynamically imported module / ChunkLoadError).
 *
 * @param factory Função que retorna a Promise de importação do componente.
 * @param retries Número de tentativas antes de desistir ou disparar recarregamento controlado (padrão: 2).
 * @param interval Intervalo em milissegundos entre as tentativas (padrão: 1000ms).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 1000
): React.LazyExoticComponent<T> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error: any) => {
            const errorMessage = error?.message || String(error);
            const isChunkError =
              errorMessage.includes('Failed to fetch dynamically imported module') ||
              errorMessage.includes('Importing a module script failed') ||
              errorMessage.includes('error loading dynamically imported module') ||
              error?.name === 'ChunkLoadError';

            if (remaining <= 0) {
              if (typeof window !== 'undefined') {
                const reloadKey = `chunk_reload_${window.location.pathname}`;
                const hasReloaded = sessionStorage.getItem(reloadKey);

                // Se for erro de chunk e ainda não recarregamos esta página na sessão, recarrega
                if (isChunkError && !hasReloaded) {
                  sessionStorage.setItem(reloadKey, 'true');
                  console.warn('[lazyWithRetry] Detectado chunk desatualizado. Recarregando página para buscar versão mais recente...');
                  window.location.reload();
                  return;
                }
              }

              console.error('[lazyWithRetry] Falha definitiva ao carregar módulo lazy:', error);
              reject(error);
              return;
            }

            // Aguarda o intervalo e tenta novamente
            setTimeout(() => {
              attempt(remaining - 1);
            }, interval);
          });
      };

      attempt(retries);
    });
  });
}
