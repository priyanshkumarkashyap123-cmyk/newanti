import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { SubscriptionProvider } from './hooks/useSubscription';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider } from './AppInitializer';
import { AppProviders } from './components/providers/AppProviders';
import { safeguards } from './utils/productionSafeguards';
import { logger } from './utils/logger';
import * as Sentry from "@sentry/react";
import env from './config/env';
import './index.css';

// Setup root element error display
function showRootError(message: string, details?: string) {
    const rootElement = document.getElementById('root');
    if (rootElement) {
        rootElement.innerHTML = `
            <div style="padding: 40px; background: #1a1a1a; color: #fff; min-height: 100vh; font-family: monospace;">
                <h1 style="color: #ff6b6b;">⚠️ ${message}</h1>
                ${details ? `<pre style="background: #2d2d2d; padding: 20px; border-radius: 8px; color: #ffa07a; overflow: auto; white-space: pre-wrap; margin-top: 20px;">${details}</pre>` : ''}
            </div>
        `;
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

        // Initialize Sentry for error tracking (wrapped in try-catch)
        try {
            if (env.monitoring.isSentryEnabled) {
                console.log('📊 Initializing Sentry...');
                Sentry.init({
                    dsn: env.monitoring.sentryDsn,
                    integrations: [
                        Sentry.browserTracingIntegration(),
                        Sentry.replayIntegration(),
                    ],
                    // Performance Monitoring
                    tracesSampleRate: 1.0,
                    tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
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
        createRoot(rootElement).render(
            <StrictMode>
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
            </StrictMode>
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
