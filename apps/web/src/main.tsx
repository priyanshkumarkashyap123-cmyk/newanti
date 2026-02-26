import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { SubscriptionProvider } from './hooks/useSubscription';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider } from './AppInitializer';
import { AppProviders } from './components/providers/AppProviders';
import { safeguards } from './utils/productionSafeguards';
import { RenderQualityManager } from './utils/gpuQuality';
import { logger } from './utils/logger';
import env from './config/env';
import './index.css';

// Setup root element error display (XSS-safe: uses textContent, not innerHTML)
function showRootError(message: string, details?: string) {
    const rootElement = document.getElementById('root');
    if (rootElement) {
        // Clear existing content
        rootElement.textContent = '';

        const container = document.createElement('div');
        container.style.cssText = 'padding: 40px; background: #1a1a1a; color: #fff; min-height: 100vh; font-family: monospace;';

        const heading = document.createElement('h1');
        heading.style.color = '#ff6b6b';
        heading.textContent = `⚠️ ${message}`;
        container.appendChild(heading);

        if (details) {
            const pre = document.createElement('pre');
            pre.style.cssText = 'background: #2d2d2d; padding: 20px; border-radius: 8px; color: #ffa07a; overflow: auto; white-space: pre-wrap; margin-top: 20px;';
            pre.textContent = details;
            container.appendChild(pre);
        }

        rootElement.appendChild(container);
    }
}

// Lazy load App to catch import errors
const initializeApp = async () => {
    try {
        // Validate environment configuration INSIDE try-catch
        console.log('🔧 Validating environment...');
        env.validate();
        console.log('✅ Environment validation passed');

        // Add explicit debug logging
        console.log('🚀 App initialization starting...');
        showRootError('Loading BeamLab...', 'Initializing application...');

        // Initialize Sentry for error tracking (lazy-loaded, wrapped in try-catch)
        try {
            if (env.monitoring.isSentryEnabled) {
                console.log('📊 Loading Sentry...');
                const Sentry = await import("@sentry/react");
                Sentry.init({
                    dsn: env.monitoring.sentryDsn,
                    integrations: [
                        Sentry.browserTracingIntegration(),
                        Sentry.replayIntegration(),
                    ],
                    // Performance Monitoring (20% sample in production to control costs)
                    tracesSampleRate: 0.2,
                    tracePropagationTargets: ["localhost", /^https:\/\/.*\.beamlabultimate\.tech/],
                    // Session Replay
                    replaysSessionSampleRate: 0.1,
                    replaysOnErrorSampleRate: 1.0,
                });
                console.log('✅ Sentry initialized');
            }
        } catch (sentryError) {
            console.warn('⚠️ Sentry initialization failed:', sentryError);
            // Continue anyway, Sentry is optional
        }

        // Initialize production safeguards (wrapped in try-catch)
        try {
            console.log('🛡️ Initializing safeguards...');
            safeguards.initialize();
            console.log('✅ Safeguards initialized');
        } catch (safeguardsError) {
            console.warn('⚠️ Safeguards initialization failed:', safeguardsError);
            // Continue anyway, safeguards are optional
        }

        // Start GPU quality detection early (non-blocking)
        RenderQualityManager.init().catch(() => {
            console.warn('⚠️ GPU quality detection failed, using defaults');
        });

        logger.info('📦 Importing App...');
        console.log('📦 About to import App component');
        const { default: App } = await import('./App');
        logger.info('✅ App imported successfully');
        console.log('✅ App imported');

        const rootElement = document.getElementById('root');
        if (!rootElement) {
            throw new Error('Root element not found');
        }

        logger.info('🎨 Rendering App...');
        console.log('🎨 About to render with providers');

        // Use unified AuthProvider which handles both Clerk and in-house auth
        // SubscriptionProvider provides subscription/tier context for feature gating
        // ErrorBoundary catches and displays any runtime errors gracefully
        // AppProviders adds: NotificationProvider, ConfirmProvider, CommandPalette (⌘K), KeyboardShortcuts (⌘/)
        // NOTE: StrictMode is intentionally NOT used here.
        // React 18 StrictMode double-invokes effects in development, which causes
        // the R3F Canvas to create and immediately destroy WebGL contexts.
        // Browsers allow only 8-16 WebGL contexts per page; double-mounting
        // exhausts this budget and leaves the 3D viewport blank/black.
        // Strict-mode linting is enforced via ESLint (react-hooks plugin) instead.
        createRoot(rootElement).render(
            <ErrorBoundary onError={(error, errorInfo) => {
                logger.error('🔴 App Error Caught:', error);
                logger.error('📍 Component Stack:', errorInfo?.componentStack);
            }}>
                <BrowserRouter>
                    <AuthProvider>
                        <SubscriptionProvider>
                            <AppProvider>
                                <AppProviders>
                                    <App />
                                </AppProviders>
                            </AppProvider>
                        </SubscriptionProvider>
                    </AuthProvider>
                </BrowserRouter>
            </ErrorBoundary>
        );


        logger.info('✅ App rendered with AuthProvider and SubscriptionProvider');
    } catch (error) {
        logger.error('❌ Failed to initialize app:', error);
        console.error('❌ Initialization error:', error);

        // Show error in DOM
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        showRootError('App Failed to Load', `Error: ${errorMessage}\n\n${errorStack}`);
    }
};

initializeApp();
