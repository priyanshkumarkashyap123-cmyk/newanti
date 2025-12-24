import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';

// Debug log
console.log('🚀 main.tsx starting...');

// Clerk publishable key from environment
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
        console.log('🔐 Clerk Key:', CLERK_PUBLISHABLE_KEY ? 'Present' : 'Missing');

        // Conditionally wrap with ClerkProvider if key is available
        if (CLERK_PUBLISHABLE_KEY) {
            createRoot(rootElement).render(
                <StrictMode>
                    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
                        <BrowserRouter>
                            <App />
                        </BrowserRouter>
                    </ClerkProvider>
                </StrictMode>
            );
        } else {
            console.warn('⚠️ VITE_CLERK_PUBLISHABLE_KEY not set - running without authentication');
            createRoot(rootElement).render(
                <StrictMode>
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </StrictMode>
            );
        }
        console.log('✅ App rendered');
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
