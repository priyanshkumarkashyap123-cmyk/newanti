import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// ============================================
// SECURITY HEADERS CONFIGURATION
// ============================================
const securityHeaders = {
  // Content Security Policy - Restrict resource loading
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.dev https://clerk.com https://*.clerk.com https://clerk.beamlabultimate.tech https://checkout.razorpay.com https://unpkg.com blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.com https://*.clerk.dev https://*.clerk.accounts.dev https://clerk.beamlabultimate.tech",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:",
    "img-src 'self' data: blob: https://*.clerk.com https://*.clerk.dev https://img.clerk.com",
    "connect-src 'self' https://*.beamlabultimate.tech https://beamlab-backend-node.azurewebsites.net https://beamlab-backend-python.azurewebsites.net https://beamlab-rust-api.azurewebsites.net https://*.azurewebsites.net https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev wss://*.clerk.accounts.dev wss://clerk.beamlabultimate.tech wss://beamlab-backend-node.azurewebsites.net wss://*.azurewebsites.net https://api.razorpay.com https://lumberjack.razorpay.com https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com https://raw.githack.com https://dl.polyhaven.org https://*.polyhaven.org https://raw.githubusercontent.com https://storage.googleapis.com",
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://clerk.beamlabultimate.tech https://api.razorpay.com https://checkout.razorpay.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),

  // Prevent clickjacking
  "X-Frame-Options": "SAMEORIGIN",

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // XSS Protection (set to 0 — modern browsers should use CSP instead; '1; mode=block' can introduce vulnerabilities)
  "X-XSS-Protection": "0",

  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions Policy - Restrict browser features
  "Permissions-Policy": [
    "accelerometer=()",
    "camera=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "payment=()",
    "usb=()",
  ].join(", "),

  // Strict Transport Security (for production)
  // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "BeamLab Ultimate",
        short_name: "BeamLab",
        description: "Advanced Structural Engineering Platform",
        theme_color: "#0b1120",
        background_color: "#0b1120",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB - for large WASM files
        // Don't cache cross-origin requests in the SW precache — only runtime cache them
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts stylesheets (CSS)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
            },
          },
          {
            // Google Fonts webfont files (woff2, etc.)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react-router-dom", "three"],
  },
  server: {
    port: 5173,
    strictPort: false,
    host: "localhost",
    cors: true,
    // Apply security headers in development
    headers: securityHeaders,
    hmr: {
      host: "localhost",
      port: 5173,
      protocol: "http",
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // Do NOT strip /api — the backend expects the /api prefix on all routes
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: [".."],
    },
  },
  esbuild: {
    // Strip console.log and console.debug in production builds.
    // KEEP console.error and console.warn — they're essential for diagnosing production issues.
    drop: process.env.NODE_ENV === "production" ? ["debugger"] : [],
    pure: process.env.NODE_ENV === "production" ? ["console.log", "console.debug", "console.info"] : [],
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production",
    minify: "esbuild",
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    // Disable modulepreload polyfill to prevent eager loading of lazy chunks
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      // Suppress warnings about unresolved dynamic imports for workers
      onwarn(warning, warn) {
        // Ignore dynamic import warnings for worker files
        if (
          warning.code === "UNRESOLVED_IMPORT" &&
          warning.message?.includes("Worker")
        ) {
          return;
        }
        // Ignore MODULE_LEVEL_DIRECTIVE warnings from third-party modules
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "router-vendor": ["react-router-dom"],
          "three-vendor": ["three", "@react-three/fiber", "@react-three/drei"],
          "animation-vendor": ["framer-motion"],
          "chart-vendor": ["recharts"],
          "clerk-vendor": ["@clerk/clerk-react"],
          "icons-vendor": ["lucide-react"],
          "math-vendor": ["mathjs"],
          "export-vendor": ["jspdf", "jspdf-autotable", "xlsx"],
          "editor-vendor": ["@monaco-editor/react"],
        },
      },
    },
  },
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
    ],
    exclude: ["solver-wasm"],
  },
});
