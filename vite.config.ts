import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import viteCompression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  plugins: [
    react(),
    viteCompression(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Sem isso, o Vite usa o nome padrão "assets" para a pasta de chunks
    // JS/CSS do build, servida em produção em /assets/*. Esse app teve uma
    // rota de SPA em /assets (hoje /ativos, página Ativos) — o mesmo caminho
    // literal do diretório de build colidia com a rota, e um reload em
    // /assets podia fazer a Vercel entregar o conteúdo bruto de um chunk JS
    // em vez do fallback para index.html, em vez de renderizar a aplicação.
    // assetsDir customizado mantido por segurança mesmo após a rota mudar.
    assetsDir: '_assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-slot', '@radix-ui/react-toast', 'class-variance-authority', 'tailwind-merge', 'clsx', 'lucide-react'],
          'vendor-supabase': ['@supabase/supabase-js'],
          // 'recharts' NÃO entra mais aqui: um manualChunks nomeado faz o Vite
          // injetar <link rel="modulepreload"> desse chunk em todo carregamento
          // (index.html), mesmo quando todo import de recharts no código está
          // atrás de um React.lazy(). Sem essa entrada, o Rollup separa
          // 'recharts' automaticamente em chunk(s) próprios só pros pontos que
          // ainda o importam estaticamente (Reports.tsx, PerformanceChart.tsx),
          // e o WorkloadChart.tsx (lazy) fica de fato sob demanda.
        }
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
}));
