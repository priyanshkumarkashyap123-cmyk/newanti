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

// Validate environment configuration
env.validate();

// Initialize Sentry for error tracking
if (env.monitoring.isSentryEnabled) {
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
} else {
    // console.log("ℹ️ Sentry DSN not found, skipping initialization");
}

// Initialize production safeguards (global error handlers, performance monitoring)
safeguards.initialize();

// Lazy load App to catch import errors
const initializeApp = async () => {
    try {
        logger.info('📦 Importing App...');
        const { default: App } = await import('./App');
        logger.info('✅ App imported successfully');

        const rootElement = document.getElementById('root');
        if (!rootElement) {
            throw new Error('Root element not found');
        }

        logger.info('🎨 Rendering App...');

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

        // Show error in DOM
        const rootElement = document.getElementById('root');
        if (rootElement) {
            rootElement.innerHTML = `
                <div style="padding: 40px; background: #1a1a1a; color: #fff; min-height: 100vh; font-family: monospace;">
                    <h1 style="color: #ff6b6b;">⚠️ App Failed to Load</h1>
                    <pre style="background: #2d2d2d; padding: 20px; border-radius: 8px; color: #ffa07a; overflow: auto; white-space: pre-wrap;">
${error instanceof Error ? error.stack || error.message : String(error)}
                    </pre>
                </div>
            `;
        }
    }
};

initializeApp();
