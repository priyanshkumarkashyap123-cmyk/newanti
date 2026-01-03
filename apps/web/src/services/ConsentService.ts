/**
 * ConsentService.ts - Manages user legal consent across the application
 * Tracks when users accept legal agreements at different points in the app flow
 */

export interface UserConsent {
    userId: string;
    consentType: ConsentType;
    acceptedAt: string;
    ipAddress?: string;
    userAgent?: string;
}

export type ConsentType = 
    | 'signup'           // On registration/login
    | 'analysis'         // Before running analysis
    | 'design'           // Before running design
    | 'pdf_export'       // Before downloading PDF
    | 'initial_landing'; // Checkbox on landing page (optional)

interface ConsentCheckpoint {
    type: ConsentType;
    required: boolean;
    title: string;
    message: string;
}

/**
 * Define consent checkpoints in the application flow
 */
export const CONSENT_CHECKPOINTS: Record<ConsentType, ConsentCheckpoint> = {
    signup: {
        type: 'signup',
        required: true,
        title: 'Accept Legal Terms to Continue',
        message: 'You must accept all legal agreements before creating or accessing your account.'
    },
    analysis: {
        type: 'analysis',
        required: true,
        title: 'Engineering Disclaimer - Analysis',
        message: 'Before running structural analysis, you must acknowledge that this software is a computational aid only and requires professional engineering verification.'
    },
    design: {
        type: 'design',
        required: true,
        title: 'Engineering Disclaimer - Design Check',
        message: 'Before running design checks, you must confirm that you understand your professional responsibility and will independently verify all results.'
    },
    pdf_export: {
        type: 'pdf_export',
        required: true,
        title: 'Report Export Terms',
        message: 'Before exporting the report, confirm that you will clearly document software usage and limitations in your project records.'
    },
    initial_landing: {
        type: 'initial_landing',
        required: false,
        title: 'Accept to Use BeamLab Ultimate',
        message: 'Review and accept the legal agreements.'
    }
};

/**
 * ConsentService - Handle user consent tracking
 */
export class ConsentService {
    private readonly storageKey = 'beamlab_user_consents';
    private readonly clerkIntegrationEnabled = typeof window !== 'undefined' && !!(window as any).__clerk_publishable_key;

    /**
     * Record that user has accepted a specific consent checkpoint
     */
    recordConsent(userId: string, consentType: ConsentType): void {
        const consent: UserConsent = {
            userId,
            consentType,
            acceptedAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        // Store locally
        this.storeConsentLocally(consent);

        // Store in Clerk metadata if available
        if (this.clerkIntegrationEnabled) {
            this.storeConsentInClerk(userId, consentType);
        }

        // Store in backend
        this.storeConsentInBackend(consent);
    }

    /**
     * Check if user has accepted a specific consent type
     */
    hasUserAccepted(userId: string, consentType: ConsentType): boolean {
        const consents = this.getStoredConsents(userId);
        return consents.some(c => c.consentType === consentType);
    }

    /**
     * Check if user has accepted all critical consents
     */
    hasAcceptedAllCritical(userId: string): boolean {
        const criticalConsents: ConsentType[] = ['signup', 'analysis', 'design', 'pdf_export'];
        return criticalConsents.every(type => this.hasUserAccepted(userId, type));
    }

    /**
     * Get all consents for a user
     */
    getStoredConsents(userId: string): UserConsent[] {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) return [];
        
        try {
            const allConsents: UserConsent[] = JSON.parse(stored);
            return allConsents.filter(c => c.userId === userId);
        } catch (e) {
            console.error('Failed to parse stored consents:', e);
            return [];
        }
    }

    /**
     * Store consent in localStorage
     */
    private storeConsentLocally(consent: UserConsent): void {
        const stored = localStorage.getItem(this.storageKey);
        let consents: UserConsent[] = [];

        if (stored) {
            try {
                consents = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse stored consents:', e);
            }
        }

        // Avoid duplicates - only store one acceptance per type per user per day
        const today = new Date().toDateString();
        const hasTodaysConsent = consents.some(c => 
            c.userId === consent.userId && 
            c.consentType === consent.consentType &&
            new Date(c.acceptedAt).toDateString() === today
        );

        if (!hasTodaysConsent) {
            consents.push(consent);
            localStorage.setItem(this.storageKey, JSON.stringify(consents));
        }
    }

    /**
     * Store consent in Clerk user metadata
     */
    private storeConsentInClerk(userId: string, consentType: ConsentType): void {
        try {
            // This would be called from a Clerk-aware component
            // For now, we emit an event that can be caught by Clerk provider
            const event = new CustomEvent('beamlab:record-consent', {
                detail: { userId, consentType, timestamp: new Date().toISOString() }
            });
            window.dispatchEvent(event);
        } catch (e) {
            console.warn('Could not store consent in Clerk:', e);
        }
    }

    /**
     * Store consent in backend database
     */
    private async storeConsentInBackend(consent: UserConsent): Promise<void> {
        try {
            const response = await fetch('https://beamlab-backend-node.azurewebsites.net/api/consent/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(consent)
            });

            if (!response.ok) {
                console.warn('Failed to store consent in backend:', response.statusText);
            }
        } catch (error) {
            console.warn('Could not reach backend for consent storage:', error);
            // Graceful degradation - consent is already stored locally
        }
    }

    /**
     * Clear all consents for a user (admin function)
     */
    clearConsents(userId: string): void {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) return;

        try {
            let consents: UserConsent[] = JSON.parse(stored);
            consents = consents.filter(c => c.userId !== userId);
            localStorage.setItem(this.storageKey, JSON.stringify(consents));
        } catch (e) {
            console.error('Failed to clear consents:', e);
        }
    }
}

export default new ConsentService();
