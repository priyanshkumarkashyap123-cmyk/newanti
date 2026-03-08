import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { SubscriptionProvider } from './hooks/useSubscription';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider } from './AppInitializer';
import { AppProviders } from './components/providers/AppProviders';
import { safeguards } from './utils/productionSafeguards';
import { RenderQualityManager } from './utils/gpuQuality';
import { logger } from './lib/logging/logger';
import env from './config/env';
import './index.css';

// Setup root element error display (XSS-safe: uses textContent, not innerHTML)
function showRootError(message: string, details?: string) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    // Clear existing content
    rootElement.textContent = '';

    const container = document.createElement('div');
    container.style.cssText =
      'padding: 40px; background: #1a1a1a; color: #fff; min-height: 100vh; font-family: monospace;';

    const heading = document.createElement('h1');
    heading.style.color = '#ff6b6b';
    heading.textContent = `⚠️ ${message}`;
    container.appendChild(heading);

    if (details) {
      const pre = document.createElement('pre');
      pre.style.cssText =
        'background: #2d2d2d; padding: 20px; border-radius: 8px; color: #ffa07a; overflow: auto; white-space: pre-wrap; margin-top: 20px;';
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
    logger.info('Validating environment');
    env.validate();
    logger.info('Environment validation passed');

    // Add explicit debug logging
    logger.info('App initialization starting');
    showRootError('Loading BeamLab...', 'Initializing application...');

    // Initialize Sentry for error tracking (lazy-loaded, wrapped in try-catch)
    try {
      if (env.monitoring.isSentryEnabled) {
        logger.info('Loading Sentry');
        const Sentry = await import('@sentry/react');
        Sentry.init({
          dsn: env.monitoring.sentryDsn,
          integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
          // Performance Monitoring (20% sample in production to control costs)
          tracesSampleRate: 0.2,
          tracePropagationTargets: ['localhost', /^https:\/\/.*\.beamlab\.app/],
          // Session Replay
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
        });
        logger.info('Sentry initialized');
      }
    } catch (sentryError) {
      logger.warn('Sentry initialization failed', { error: sentryError });
      // Continue anyway, Sentry is optional
    }

    // Initialize production safeguards (wrapped in try-catch)
    try {
      logger.info('Initializing safeguards');
      safeguards.initialize();
      logger.info('Safeguards initialized');
    } catch (safeguardsError) {
      logger.warn('Safeguards initialization failed', { error: safeguardsError });
      // Continue anyway, safeguards are optional
    }

    // Start GPU quality detection early (non-blocking)
    RenderQualityManager.init().catch(() => {
      logger.warn('GPU quality detection failed, using defaults');
    });

    // Track Core Web Vitals (LCP, FID, CLS, FCP, TTFB)
    try {
      const { trackWebVitals } = await import('./lib/performance');
      trackWebVitals((metric) => {
        logger.info(`[WebVitals] ${metric.name}: ${metric.value.toFixed(1)}ms (${metric.rating})`);
      });
    } catch {
      logger.warn('Web Vitals tracking unavailable');
    }

    logger.info('Importing App component');
    const { default: App } = await import('./App');
    logger.info('App imported successfully');

    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    logger.info('Rendering App with providers');

    // Remove the initial static loader now that React is taking over
    const initialLoader = document.getElementById('initial-loader');
    if (initialLoader) {
      initialLoader.remove();
    }
    // Signal to the timeout checker that the app loaded
    (window as any).__beamlab_loaded__ = true;

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
      <ErrorBoundary
        onError={(error, errorInfo) => {
          logger.error('App error caught by ErrorBoundary', { error });
          logger.error('Component stack trace', { componentStack: errorInfo?.componentStack });
        }}
      >
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
      </ErrorBoundary>,
    );

    logger.info('App rendered with AuthProvider and SubscriptionProvider');
  } catch (error) {
    logger.error('Failed to initialize app', { error });
    console.error('❌ Initialization error:', error);

    // Show error in DOM
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    showRootError('App Failed to Load', `Error: ${errorMessage}\n\n${errorStack}`);
  }
};

initializeApp();
