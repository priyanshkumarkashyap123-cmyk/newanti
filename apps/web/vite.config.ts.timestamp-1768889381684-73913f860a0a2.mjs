// vite.config.ts
import { defineConfig } from "file:///Users/rakshittiwari/Desktop/newanti/node_modules/.pnpm/vite@5.4.21_@types+node@22.19.3_lightningcss@1.30.2/node_modules/vite/dist/node/index.js";
import react from "file:///Users/rakshittiwari/Desktop/newanti/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@22.19.3_lightningcss@1.30.2_/node_modules/@vitejs/plugin-react/dist/index.js";
import wasm from "file:///Users/rakshittiwari/Desktop/newanti/node_modules/.pnpm/vite-plugin-wasm@3.5.0_vite@5.4.21_@types+node@22.19.3_lightningcss@1.30.2_/node_modules/vite-plugin-wasm/exports/import.mjs";
import topLevelAwait from "file:///Users/rakshittiwari/Desktop/newanti/node_modules/.pnpm/vite-plugin-top-level-await@1.6.0_rollup@4.54.0_vite@5.4.21_@types+node@22.19.3_lightningcss@1.30.2_/node_modules/vite-plugin-top-level-await/exports/import.mjs";
import path from "path";
var __vite_injected_original_dirname = "/Users/rakshittiwari/Desktop/newanti/apps/web";
var securityHeaders = {
  // Content Security Policy - Restrict resource loading
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.clerk.accounts.dev",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.clerk.accounts.dev wss://*.clerk.accounts.dev https://api.anthropic.com https://generativelanguage.googleapis.com",
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; "),
  // Prevent clickjacking
  "X-Frame-Options": "SAMEORIGIN",
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Enable XSS filter
  "X-XSS-Protection": "1; mode=block",
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
    "usb=()"
  ].join(", ")
  // Strict Transport Security (for production)
  // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};
var vite_config_default = defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }]
        ]
      }
    }),
    wasm(),
    topLevelAwait()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
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
      protocol: "http"
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path2) => path2.replace(/^\/api/, "")
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        changeOrigin: true
      }
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: [".."]
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    minify: "esbuild",
    target: "esnext",
    rollupOptions: {
      // Suppress warnings about unresolved dynamic imports for workers
      onwarn(warning, warn) {
        if (warning.code === "UNRESOLVED_IMPORT" && warning.message?.includes("Worker")) {
          return;
        }
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "three-vendor": ["three", "@react-three/fiber", "@react-three/drei"]
        }
      }
    }
  },
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()]
  },
  optimizeDeps: {
    include: ["react", "react-dom", "three", "@react-three/fiber", "@react-three/drei"],
    exclude: ["solver-wasm"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvcmFrc2hpdHRpd2FyaS9EZXNrdG9wL25ld2FudGkvYXBwcy93ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9yYWtzaGl0dGl3YXJpL0Rlc2t0b3AvbmV3YW50aS9hcHBzL3dlYi92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvcmFrc2hpdHRpd2FyaS9EZXNrdG9wL25ld2FudGkvYXBwcy93ZWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgd2FzbSBmcm9tICd2aXRlLXBsdWdpbi13YXNtJztcbmltcG9ydCB0b3BMZXZlbEF3YWl0IGZyb20gJ3ZpdGUtcGx1Z2luLXRvcC1sZXZlbC1hd2FpdCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNFQ1VSSVRZIEhFQURFUlMgQ09ORklHVVJBVElPTlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmNvbnN0IHNlY3VyaXR5SGVhZGVycyA9IHtcbiAgLy8gQ29udGVudCBTZWN1cml0eSBQb2xpY3kgLSBSZXN0cmljdCByZXNvdXJjZSBsb2FkaW5nXG4gICdDb250ZW50LVNlY3VyaXR5LVBvbGljeSc6IFtcbiAgICBcImRlZmF1bHQtc3JjICdzZWxmJ1wiLFxuICAgIFwic2NyaXB0LXNyYyAnc2VsZicgJ3Vuc2FmZS1pbmxpbmUnICd1bnNhZmUtZXZhbCcgaHR0cHM6Ly9jaGFsbGVuZ2VzLmNsb3VkZmxhcmUuY29tIGh0dHBzOi8vKi5jbGVyay5hY2NvdW50cy5kZXZcIixcbiAgICBcInN0eWxlLXNyYyAnc2VsZicgJ3Vuc2FmZS1pbmxpbmUnIGh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb21cIixcbiAgICBcImZvbnQtc3JjICdzZWxmJyBodHRwczovL2ZvbnRzLmdzdGF0aWMuY29tXCIsXG4gICAgXCJpbWctc3JjICdzZWxmJyBkYXRhOiBibG9iOiBodHRwczpcIixcbiAgICBcImNvbm5lY3Qtc3JjICdzZWxmJyBodHRwczovLyouY2xlcmsuYWNjb3VudHMuZGV2IHdzczovLyouY2xlcmsuYWNjb3VudHMuZGV2IGh0dHBzOi8vYXBpLmFudGhyb3BpYy5jb20gaHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb21cIixcbiAgICBcImZyYW1lLXNyYyAnc2VsZicgaHR0cHM6Ly9jaGFsbGVuZ2VzLmNsb3VkZmxhcmUuY29tIGh0dHBzOi8vKi5jbGVyay5hY2NvdW50cy5kZXZcIixcbiAgICBcIndvcmtlci1zcmMgJ3NlbGYnIGJsb2I6XCIsXG4gICAgXCJvYmplY3Qtc3JjICdub25lJ1wiLFxuICAgIFwiYmFzZS11cmkgJ3NlbGYnXCIsXG4gICAgXCJmb3JtLWFjdGlvbiAnc2VsZidcIixcbiAgXS5qb2luKCc7ICcpLFxuICBcbiAgLy8gUHJldmVudCBjbGlja2phY2tpbmdcbiAgJ1gtRnJhbWUtT3B0aW9ucyc6ICdTQU1FT1JJR0lOJyxcbiAgXG4gIC8vIFByZXZlbnQgTUlNRSB0eXBlIHNuaWZmaW5nXG4gICdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJzogJ25vc25pZmYnLFxuICBcbiAgLy8gRW5hYmxlIFhTUyBmaWx0ZXJcbiAgJ1gtWFNTLVByb3RlY3Rpb24nOiAnMTsgbW9kZT1ibG9jaycsXG4gIFxuICAvLyBDb250cm9sIHJlZmVycmVyIGluZm9ybWF0aW9uXG4gICdSZWZlcnJlci1Qb2xpY3knOiAnc3RyaWN0LW9yaWdpbi13aGVuLWNyb3NzLW9yaWdpbicsXG4gIFxuICAvLyBQZXJtaXNzaW9ucyBQb2xpY3kgLSBSZXN0cmljdCBicm93c2VyIGZlYXR1cmVzXG4gICdQZXJtaXNzaW9ucy1Qb2xpY3knOiBbXG4gICAgJ2FjY2VsZXJvbWV0ZXI9KCknLFxuICAgICdjYW1lcmE9KCknLFxuICAgICdnZW9sb2NhdGlvbj0oKScsXG4gICAgJ2d5cm9zY29wZT0oKScsXG4gICAgJ21hZ25ldG9tZXRlcj0oKScsXG4gICAgJ21pY3JvcGhvbmU9KCknLFxuICAgICdwYXltZW50PSgpJyxcbiAgICAndXNiPSgpJyxcbiAgXS5qb2luKCcsICcpLFxuICBcbiAgLy8gU3RyaWN0IFRyYW5zcG9ydCBTZWN1cml0eSAoZm9yIHByb2R1Y3Rpb24pXG4gIC8vICdTdHJpY3QtVHJhbnNwb3J0LVNlY3VyaXR5JzogJ21heC1hZ2U9MzE1MzYwMDA7IGluY2x1ZGVTdWJEb21haW5zOyBwcmVsb2FkJyxcbn07XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3Qoe1xuICAgICAgYmFiZWw6IHtcbiAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgIFsnQGJhYmVsL3BsdWdpbi10cmFuc2Zvcm0tcmVhY3QtanN4JywgeyBydW50aW1lOiAnYXV0b21hdGljJyB9XSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gICAgd2FzbSgpLFxuICAgIHRvcExldmVsQXdhaXQoKSxcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgc3RyaWN0UG9ydDogZmFsc2UsXG4gICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgY29yczogdHJ1ZSxcbiAgICAvLyBBcHBseSBzZWN1cml0eSBoZWFkZXJzIGluIGRldmVsb3BtZW50XG4gICAgaGVhZGVyczogc2VjdXJpdHlIZWFkZXJzLFxuICAgIGhtcjoge1xuICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgcHJvdG9jb2w6ICdodHRwJyxcbiAgICB9LFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLywgJycpLFxuICAgICAgfSxcbiAgICAgICcvd3MnOiB7XG4gICAgICAgIHRhcmdldDogJ3dzOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGZzOiB7XG4gICAgICAvLyBBbGxvdyBzZXJ2aW5nIGZpbGVzIGZyb20gb25lIGxldmVsIHVwIHRvIHRoZSBwcm9qZWN0IHJvb3RcbiAgICAgIGFsbG93OiBbJy4uJ10sXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAvLyBTdXBwcmVzcyB3YXJuaW5ncyBhYm91dCB1bnJlc29sdmVkIGR5bmFtaWMgaW1wb3J0cyBmb3Igd29ya2Vyc1xuICAgICAgb253YXJuKHdhcm5pbmcsIHdhcm4pIHtcbiAgICAgICAgLy8gSWdub3JlIGR5bmFtaWMgaW1wb3J0IHdhcm5pbmdzIGZvciB3b3JrZXIgZmlsZXNcbiAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ1VOUkVTT0xWRURfSU1QT1JUJyAmJiB3YXJuaW5nLm1lc3NhZ2U/LmluY2x1ZGVzKCdXb3JrZXInKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZ25vcmUgTU9EVUxFX0xFVkVMX0RJUkVDVElWRSB3YXJuaW5ncyBmcm9tIHRoaXJkLXBhcnR5IG1vZHVsZXNcbiAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ01PRFVMRV9MRVZFTF9ESVJFQ1RJVkUnKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHdhcm4od2FybmluZyk7XG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICdyZWFjdC12ZW5kb3InOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICAgICd0aHJlZS12ZW5kb3InOiBbJ3RocmVlJywgJ0ByZWFjdC10aHJlZS9maWJlcicsICdAcmVhY3QtdGhyZWUvZHJlaSddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICB3b3JrZXI6IHtcbiAgICBmb3JtYXQ6ICdlcycsXG4gICAgcGx1Z2luczogKCkgPT4gW3dhc20oKSwgdG9wTGV2ZWxBd2FpdCgpXSxcbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgaW5jbHVkZTogWydyZWFjdCcsICdyZWFjdC1kb20nLCAndGhyZWUnLCAnQHJlYWN0LXRocmVlL2ZpYmVyJywgJ0ByZWFjdC10aHJlZS9kcmVpJ10sXG4gICAgZXhjbHVkZTogWydzb2x2ZXItd2FzbSddLFxuICB9LFxufSk7XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVQsU0FBUyxvQkFBb0I7QUFDdFYsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLFVBQVU7QUFKakIsSUFBTSxtQ0FBbUM7QUFTekMsSUFBTSxrQkFBa0I7QUFBQTtBQUFBLEVBRXRC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
