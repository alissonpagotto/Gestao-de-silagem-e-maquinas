import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const FALLBACK_SUPABASE_URL = 'https://dyemddjnqoxqyabbhixu.supabase.co';
  const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_SPzmag-Va8d6RH8lVY9Zow_th9ReW1c';

  const rawUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const cleanedUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const supabaseUrl = (cleanedUrl && cleanedUrl.includes('.supabase.co') && !cleanedUrl.includes('supabase.https:'))
    ? cleanedUrl
    : FALLBACK_SUPABASE_URL;

  const rawKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const isValidKey = (
    rawKey.length >= 30 &&
    !rawKey.includes('@') &&
    !rawKey.includes(' ') &&
    !rawKey.startsWith('http') &&
    (rawKey.startsWith('sb_') || rawKey.startsWith('eyJ'))
  );
  const supabaseKey = isValidKey ? rawKey : FALLBACK_SUPABASE_ANON_KEY;

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'upload-fallback-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && (req.url.startsWith('/upload/') || req.url.startsWith('/upload'))) {
              res.writeHead(200, {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=86400',
              });
              res.end(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f4f4f5"/><path d="M50 42a12 12 0 100-24 12 12 0 000 24zm-22 36c0-11 9.8-20 22-20s22 9 22 20H28z" fill="#a1a1aa"/></svg>'
              );
              return;
            }
            next();
          });
        },
      },
    ],
    envPrefix: ['VITE_', 'SUPABASE_'],
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
              return 'pdf-vendor';
            }
            if (id.includes('node_modules/recharts')) {
              return 'charts-vendor';
            }
            if (id.includes('node_modules/@supabase')) {
              return 'supabase-vendor';
            }
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      cors: true,
      allowedHosts: true,
      // HMR WebSockets disabled in AI Studio iframe environment to prevent WebSocket connection failures
      hmr: false,
      watch: null,
    },
  };
});
