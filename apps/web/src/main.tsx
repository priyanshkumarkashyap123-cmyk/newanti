import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { SubscriptionProvider } from './hooks/useSubscription';
import { ErrorBoundary } from './components/ErrorBoundary';
import { safeguards } from './utils/productionSafeguards';
import './index.css';

// Initialize production safeguards (global error handlers, performance monitoring)
safeguards.initialize();

// Debug log
console.log('🚀 main.tsx starting...');

// Lazy load App to catch import errors
const initializeApp = async () => {
    try {
        console.log('📦 Importing App...');
        const { default: App } = await import('./App');
        console.log('✅ App imported successfully');

        const rootElement = document.getElementById('root');
        if (!rootElement) {
            throw new Error('Root element not found');
        }

        console.log('🎨 Rendering App...');
        
        // Use unified AuthProvider which handles both Clerk and in-house auth
        // SubscriptionProvider provides subscription/tier context for feature gating
        // ErrorBoundary catches and displays any runtime errors gracefully
        createRoot(rootElement).render(
            <StrictMode>
                <ErrorBoundary onError={(error, errorInfo) => {
                    console.error('🔴 App Error Caught:', error);
                    console.error('📍 Component Stack:', errorInfo?.componentStack);
                }}>
                    <BrowserRouter>
                        <AuthProvider>
                            <SubscriptionProvider>
                                <App />
                            </SubscriptionProvider>
                        </AuthProvider>
                    </BrowserRouter>
                </ErrorBoundary>
            </StrictMode>
        );
        
        console.log('✅ App rendered with AuthProvider and SubscriptionProvider');
    } catch (error) {
        console.error('❌ Failed to initialize app:', error);

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
