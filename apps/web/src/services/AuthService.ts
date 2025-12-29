/**
 * AuthService.ts - Authentication API Service
 * 
 * Handles all authentication-related API calls for the in-house auth system.
 * Works alongside authStore for state management.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================
// TYPES
// ============================================

export interface SignInRequest {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface SignUpRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    company?: string;
    phone?: string;
    acceptTerms: boolean;
}

export interface AuthResponse {
    success: boolean;
    user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string;
        emailVerified: boolean;
        createdAt: string;
        role: 'user' | 'admin' | 'enterprise';
        subscriptionTier: 'free' | 'pro' | 'enterprise';
    };
    accessToken?: string;
    refreshToken?: string;
    message?: string;
    errors?: Record<string, string>;
}

export interface PasswordResetRequest {
    email: string;
}

export interface PasswordResetConfirm {
    token: string;
    newPassword: string;
    confirmPassword: string;
}

export interface ProfileUpdateRequest {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    company?: string;
    phone?: string;
}

// ============================================
// AUTH SERVICE CLASS
// ============================================

class AuthService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = `${API_BASE}/api/auth`;
    }

    // ========================================
    // SIGN IN
    // ========================================
    async signIn(credentials: SignInRequest): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/signin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Sign in failed',
                    errors: data.errors
                };
            }

            return {
                success: true,
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // SIGN UP
    // ========================================
    async signUp(data: SignUpRequest): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: result.message || 'Sign up failed',
                    errors: result.errors
                };
            }

            return {
                success: true,
                user: result.user,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // SIGN OUT
    // ========================================
    async signOut(accessToken: string, refreshToken: string): Promise<boolean> {
        try {
            await fetch(`${this.baseUrl}/signout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ refreshToken }),
                credentials: 'include'
            });
            return true;
        } catch {
            return false;
        }
    }

    // ========================================
    // REFRESH TOKEN
    // ========================================
    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Token refresh failed'
                };
            }

            return {
                success: true,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // GET CURRENT USER
    // ========================================
    async getCurrentUser(accessToken: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/me`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Failed to get user'
                };
            }

            return {
                success: true,
                user: data
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // VERIFY EMAIL
    // ========================================
    async verifyEmail(accessToken: string, code: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ code }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Verification failed'
                };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // RESEND VERIFICATION EMAIL
    // ========================================
    async resendVerificationEmail(accessToken: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/resend-verification`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Failed to resend'
                };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // FORGOT PASSWORD
    // ========================================
    async forgotPassword(request: PasswordResetRequest): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Request failed'
                };
            }

            return { success: true, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // RESET PASSWORD
    // ========================================
    async resetPassword(request: PasswordResetConfirm): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Reset failed',
                    errors: data.errors
                };
            }

            return { success: true, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // CHANGE PASSWORD
    // ========================================
    async changePassword(
        accessToken: string,
        currentPassword: string,
        newPassword: string
    ): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ currentPassword, newPassword }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Change failed',
                    errors: data.errors
                };
            }

            return { success: true, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // UPDATE PROFILE
    // ========================================
    async updateProfile(
        accessToken: string,
        updates: ProfileUpdateRequest
    ): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(updates),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Update failed',
                    errors: data.errors
                };
            }

            return { success: true, user: data };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // DELETE ACCOUNT
    // ========================================
    async deleteAccount(accessToken: string, password: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/delete-account`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Deletion failed'
                };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // ========================================
    // CHECK EMAIL AVAILABILITY
    // ========================================
    async checkEmail(email: string): Promise<{ available: boolean }> {
        try {
            const response = await fetch(`${this.baseUrl}/check-email?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            return { available: data.available ?? false };
        } catch {
            return { available: false };
        }
    }

    // ========================================
    // OAUTH PROVIDERS (future support)
    // ========================================
    getOAuthUrl(provider: 'google' | 'github' | 'microsoft'): string {
        return `${this.baseUrl}/oauth/${provider}`;
    }
}

// Export singleton instance
export const authService = new AuthService();

export default authService;
