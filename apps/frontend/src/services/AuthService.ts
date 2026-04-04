/**
 * AuthService.ts - Authentication API Service
 * 
 * Handles all authentication-related API calls for the in-house auth system.
 * Works alongside authStore for state management.
 */

import { API_CONFIG } from '../config/env';
import { fetchWithTimeout, type FetchOptions } from '../utils/fetchUtils';

const API_BASE = API_CONFIG.baseUrl;

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
            const response = await fetchWithTimeout<AuthResponse>(`${this.baseUrl}/signin`, {
                method: 'POST',
                body: JSON.stringify(credentials),
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Sign in failed'
                };
            }

            const data = response.data;
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
            const response = await fetchWithTimeout<AuthResponse>(`${this.baseUrl}/signup`, {
                method: 'POST',
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Sign up failed'
                };
            }

            const result = response.data;
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
            const response = await fetchWithTimeout(`${this.baseUrl}/signout`, {
                method: 'POST',
                authToken: accessToken,
                body: JSON.stringify({ refreshToken }),
                credentials: 'include'
            });
            return response.success;
        } catch {
            return false;
        }
    }

    // ========================================
    // REFRESH TOKEN
    // ========================================
    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        try {
            const response = await fetchWithTimeout<AuthResponse>(`${this.baseUrl}/refresh`, {
                method: 'POST',
                body: JSON.stringify({ refreshToken }),
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Token refresh failed'
                };
            }

            const data = response.data;
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
            const response = await fetchWithTimeout<any>(`${this.baseUrl}/me`, {
                authToken: accessToken,
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Failed to get user'
                };
            }

            return {
                success: true,
                user: response.data
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
            const response = await fetchWithTimeout<{ success: boolean; message?: string }>(`${this.baseUrl}/verify-email`, {
                method: 'POST',
                authToken: accessToken,
                body: JSON.stringify({ code }),
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Verification failed'
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
            const response = await fetchWithTimeout<{ success: boolean; message?: string }>(`${this.baseUrl}/resend-verification`, {
                method: 'POST',
                authToken: accessToken,
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Failed to resend'
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
            const response = await fetchWithTimeout<{ success: boolean; message?: string }>(`${this.baseUrl}/forgot-password`, {
                method: 'POST',
                body: JSON.stringify(request)
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Request failed'
                };
            }

            return { success: true, message: response.data.message };
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
            const response = await fetchWithTimeout<{ success: boolean; message?: string }>(`${this.baseUrl}/reset-password`, {
                method: 'POST',
                body: JSON.stringify(request)
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Reset failed'
                };
            }

            return { success: true, message: response.data.message };
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
            const response = await fetchWithTimeout<{ success: boolean; message?: string }>(`${this.baseUrl}/change-password`, {
                method: 'POST',
                authToken: accessToken,
                body: JSON.stringify({ currentPassword, newPassword }),
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Change failed'
                };
            }

            return { success: true, message: response.data.message };
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
            const response = await fetchWithTimeout<any>(`${this.baseUrl}/profile`, {
                method: 'PUT',
                authToken: accessToken,
                body: JSON.stringify(updates),
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Update failed'
                };
            }

            return { success: true, user: response.data };
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
            const response = await fetchWithTimeout<{ success: boolean; message?: string }>(`${this.baseUrl}/delete-account`, {
                method: 'DELETE',
                authToken: accessToken,
                body: JSON.stringify({ password }),
                credentials: 'include'
            });

            if (!response.success || !response.data) {
                return {
                    success: false,
                    message: response.error || 'Deletion failed'
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
            const response = await fetchWithTimeout<{ available: boolean }>(`${this.baseUrl}/check-email?email=${encodeURIComponent(email)}`, {});
            return { available: response.data?.available ?? false };
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
