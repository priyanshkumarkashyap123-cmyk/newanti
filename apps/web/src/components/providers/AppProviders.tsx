/**
 * AppProviders Component
 * Wraps the entire application with all necessary UI providers
 * 
 * This provides:
 * - NotificationProvider (toast notifications)
 * - ConfirmProvider (confirmation dialogs)
 * - CommandPalette (⌘K global command search)
 * - KeyboardShortcuts (⌘/ help modal)
 * - ErrorBoundary (crash protection)
 */

import { FC, ReactNode } from 'react';
import { ErrorBoundary } from '../../lib/errorHandling';
import { NotificationProvider, useNotifications, createNotificationHelpers } from '../ui/NotificationManager';
import { ConfirmProvider } from '../ui/ConfirmDialog';
import { CommandPalette, useCommandPalette } from '../ui/CommandPalette';
import { KeyboardShortcuts, useKeyboardShortcuts } from '../ui/KeyboardShortcuts';
import { ToastProvider } from '../ui/ToastSystem';

// ============================================
// Global Keyboard Features Component
// ============================================

const GlobalKeyboardFeatures: FC = () => {
    const commandPalette = useCommandPalette();
    const keyboardShortcuts = useKeyboardShortcuts();

    return (
        <>
            {/* Command Palette - ⌘K */}
            <CommandPalette
                isOpen={commandPalette.isOpen}
                onClose={commandPalette.close}
            />

            {/* Keyboard Shortcuts Modal - ⌘/ */}
            <KeyboardShortcuts
                isOpen={keyboardShortcuts.isOpen}
                onClose={keyboardShortcuts.close}
            />
        </>
    );
};

// ============================================
// App Providers Component
// ============================================

interface AppProvidersProps {
    children: ReactNode;
}

export const AppProviders: FC<AppProvidersProps> = ({ children }) => {
    return (
        <ErrorBoundary>
            <NotificationProvider position="bottom-right" maxVisible={5}>
                <ConfirmProvider>
                    <ToastProvider>
                        {children}
                        <GlobalKeyboardFeatures />
                    </ToastProvider>
                </ConfirmProvider>
            </NotificationProvider>
        </ErrorBoundary>
    );
};

// ============================================
// useAppNotifications Hook
// Convenience hook for notifications with helpers
// ============================================

export const useAppNotifications = () => {
    const { notify, dismiss, dismissAll, update } = useNotifications();
    const helpers = createNotificationHelpers(notify, update);

    return {
        notify,
        dismiss,
        dismissAll,
        update,
        toast: helpers,
    };
};

export default AppProviders;
