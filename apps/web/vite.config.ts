import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';



// ============================================
// SECURITY HEADERS CONFIGURATION
// ============================================
const securityHeaders = {
  // Content Security Policy - Restrict resource loading
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://clerk.com https://*.clerk.com blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.com https://*.clerk.dev",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.beamlabultimate.tech https://beamlab-backend-node.azurewebsites.net https://beamlab-rust-api.azurewebsites.net https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev wss://*.clerk.accounts.dev https://api.anthropic.com https://generativelanguage.googleapis.com",
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),

  // Prevent clickjacking
  'X-Frame-Options': 'SAMEORIGIN',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS filter
  'X-XSS-Protection': '1; mode=block',

  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions Policy - Restrict browser features
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ].join(', '),

  // Strict Transport Security (for production)
  // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
        ],
      },
    }),
    wasm(),
    topLevelAwait(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'BeamLab Ultimate',
        short_name: 'BeamLab',
        description: 'Advanced Structural Engineering Platform',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB - for large WASM files
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: 'localhost',
    cors: true,
    // Apply security headers in development
    headers: securityHeaders,
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'http',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      // Suppress warnings about unresolved dynamic imports for workers
      onwarn(warning, warn) {
        // Ignore dynamic import warnings for worker files
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.message?.includes('Worker')) {
          return;
        }
        // Ignore MODULE_LEVEL_DIRECTIVE warnings from third-party modules
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
    exclude: ['solver-wasm'],
  },
});

