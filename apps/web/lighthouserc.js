/**
 * ============================================================================
 * LIGHTHOUSE CI CONFIGURATION
 * ============================================================================
 * 
 * Performance budgets and automated audits:
 * - Performance scoring thresholds
 * - Accessibility requirements
 * - Best practices enforcement
 * - SEO optimization checks
 * 
 * Run: npx lhci autorun
 * ============================================================================
 */

module.exports = {
    ci: {
        collect: {
            // Static server for the built app
            staticDistDir: './dist',
            
            // URLs to test
            url: [
                'http://localhost:5173/',
                'http://localhost:5173/dashboard',
                'http://localhost:5173/sign-in',
            ],
            
            // Number of runs per URL
            numberOfRuns: 3,
            
            // Puppeteer launch options
            puppeteerLaunchOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-gpu'],
            },
            
            // Chrome flags
            settings: {
                chromeFlags: '--no-sandbox',
                preset: 'desktop',
                throttling: {
                    // Simulate fast 3G
                    rttMs: 40,
                    throughputKbps: 10240,
                    cpuSlowdownMultiplier: 1,
                },
            },
        },
        
        assert: {
            // Assertion configuration
            preset: 'lighthouse:recommended',
            
            assertions: {
                // Performance assertions
                'categories:performance': ['error', { minScore: 0.8 }],
                'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
                'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
                'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
                'total-blocking-time': ['warn', { maxNumericValue: 300 }],
                'speed-index': ['warn', { maxNumericValue: 3000 }],
                'interactive': ['warn', { maxNumericValue: 3500 }],
                
                // Accessibility assertions
                'categories:accessibility': ['error', { minScore: 0.9 }],
                'color-contrast': 'error',
                'document-title': 'error',
                'html-has-lang': 'error',
                'meta-viewport': 'error',
                'button-name': 'error',
                'link-name': 'error',
                'image-alt': 'error',
                
                // Best practices
                'categories:best-practices': ['warn', { minScore: 0.85 }],
                'uses-http2': 'warn',
                'uses-passive-event-listeners': 'warn',
                'no-document-write': 'error',
                'js-libraries': 'off', // We use modern libraries
                
                // SEO
                'categories:seo': ['warn', { minScore: 0.9 }],
                'meta-description': 'warn',
                'robots-txt': 'off', // SPA doesn't need robots.txt
                
                // PWA (optional for our app)
                'categories:pwa': 'off',
                
                // Resource size budgets
                'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }],
                'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }],
                'resource-summary:image:size': ['warn', { maxNumericValue: 300000 }],
                'resource-summary:font:size': ['warn', { maxNumericValue: 150000 }],
                
                // Disable some checks not applicable to our app
                'csp-xss': 'off', // Handled at deployment level
                'errors-in-console': 'warn', // Development warnings OK
                'deprecations': 'warn',
            },
        },
        
        upload: {
            // Upload to temporary public storage (for CI)
            target: 'temporary-public-storage',
            
            // Or upload to LHCI server
            // target: 'lhci',
            // serverBaseUrl: 'https://lhci.beamlab.dev',
            // token: process.env.LHCI_TOKEN,
        },
    },
};
