/**
 * authStore.ts - In-House Authentication State Management
 *
 * Zustand store for managing authentication state when not using Clerk.
 * Supports JWT-based authentication with refresh tokens.
 *
 * Features:
 * - User state management
 * - Token storage (localStorage)
 * - Session persistence
 * - Auto-refresh tokens
 */

import { create, StateCreator } from "zustand";
import { persist, PersistOptions, createJSONStorage } from "zustand/middleware";

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  role: "user" | "admin" | "enterprise";
  subscriptionTier: "free" | "pro" | "enterprise";
  company?: string;
  phone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

export interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Computed
  isSignedIn: boolean;
  userId: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;

  // Auth actions
  signIn: (email: string, password: string) => Promise<boolean>;
  socialSignIn: (provider: "google" | "github") => Promise<boolean>;
  signUp: (data: SignUpData) => Promise<boolean>;
  signOut: () => void;
  refreshSession: () => Promise<boolean>;
  verifyEmail: (code: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;

  // Session management
  checkSession: () => Promise<boolean>;
  getAccessToken: () => string | null;
}

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
}

// ============================================
// API BASE URL
// ============================================

const API_BASE =
  import.meta.env.VITE_API_URL || "https://api.beamlabultimate.tech";

// ============================================
// HELPER FUNCTIONS
// ============================================

const isTokenExpired = (expiresAt: number): boolean => {
  // Consider token expired 60 seconds before actual expiry
  return Date.now() >= expiresAt - 60000;
};

const parseJWT = (token: string): { exp: number; sub: string } | null => {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// ============================================
// AUTH STORE
// ============================================

// Type for persisted state
type PersistedAuthState = Pick<AuthState, "user" | "tokens">;

// Persist options
const persistOptions: PersistOptions<AuthState, PersistedAuthState> = {
  name: "beamlab-auth",
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    user: state.user,
    tokens: state.tokens,
  }),
};

// Store creator
const authStoreCreator: StateCreator<AuthState> = (set, get) => ({
  // Initial state
  user: null,
  tokens: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  // Computed getters (updated when state changes)
  get isSignedIn() {
    const state = get();
    return (
      state.user !== null &&
      state.tokens !== null &&
      !isTokenExpired(state.tokens.expiresAt)
    );
  },

  get userId() {
    return get().user?.id ?? null;
  },

  // Basic setters
  setUser: (user) => set({ user }),
  setTokens: (tokens) => set({ tokens }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setInitialized: (isInitialized) => set({ isInitialized }),

  // ========================================
  // SIGN IN
  // ========================================
  socialSignIn: async (provider: "google" | "github"): Promise<boolean> => {
    // SECURITY: Mock social sign-in is only available in development mode.
    // In production, social auth is handled by Clerk — this code path should never run.
    if (import.meta.env.PROD) {
      console.error('socialSignIn mock is disabled in production. Use Clerk OAuth instead.');
      set({ error: 'Social sign-in is not available in this mode.', isLoading: false });
      return false;
    }

    set({ isLoading: true, error: null });

    // Simulate network delay (DEV only)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      // Create mock user based on provider
      const isGoogle = provider === "google";
      const mockUser: User = {
        id: `social-${provider}-${Date.now()}`,
        email: isGoogle ? "google.user@example.com" : "github.user@example.com",
        firstName: isGoogle ? "Google" : "GitHub",
        lastName: "User",
        avatarUrl: isGoogle
          ? "https://lh3.googleusercontent.com/a/ACg8ocIq8dJ..."
          : "https://avatars.githubusercontent.com/u/123456?v=4",
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: "user",
        subscriptionTier: "free",
      };

      const mockTokens: AuthTokens = {
        accessToken: "mock-jwt-token-social",
        refreshToken: "mock-refresh-token-social",
        expiresAt: Date.now() + 3600000 * 24, // 24 hours
      };

      set({
        user: mockUser,
        tokens: mockTokens,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      set({
        error: "Social sign in failed",
        isLoading: false,
      });
      return false;
    }
  },

  signIn: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        set({ error: data.message || "Sign in failed", isLoading: false });
        return false;
      }

      const { user, accessToken, refreshToken } = data;
      const decoded = parseJWT(accessToken);

      set({
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresAt: decoded?.exp ? decoded.exp * 1000 : Date.now() + 3600000,
        },
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Network error",
        isLoading: false,
      });
      return false;
    }
  },

  // ========================================
  // SIGN UP
  // ========================================
  signUp: async (data: SignUpData): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        set({ error: result.message || "Sign up failed", isLoading: false });
        return false;
      }

      const { user, accessToken, refreshToken } = result;
      const decoded = parseJWT(accessToken);

      set({
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresAt: decoded?.exp ? decoded.exp * 1000 : Date.now() + 3600000,
        },
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Network error",
        isLoading: false,
      });
      return false;
    }
  },

  // ========================================
  // SIGN OUT
  // ========================================
  signOut: () => {
    // Call logout endpoint
    const tokens = get().tokens;
    if (tokens?.refreshToken) {
      fetch(`${API_BASE}/api/auth/signout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        credentials: "include",
      }).catch(() => {
        // Ignore errors during logout
      });
    }

    // Clear local state
    set({
      user: null,
      tokens: null,
      error: null,
    });

    // Clear localStorage
    localStorage.removeItem("beamlab-auth");
  },

  // ========================================
  // REFRESH SESSION
  // ========================================
  refreshSession: async (): Promise<boolean> => {
    const { tokens } = get();

    if (!tokens?.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        credentials: "include",
      });

      if (!response.ok) {
        // Refresh failed - sign out
        get().signOut();
        return false;
      }

      const data = await response.json();
      const decoded = parseJWT(data.accessToken);

      set({
        tokens: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || tokens.refreshToken,
          expiresAt: decoded?.exp ? decoded.exp * 1000 : Date.now() + 3600000,
        },
      });

      return true;
    } catch {
      return false;
    }
  },

  // ========================================
  // VERIFY EMAIL
  // ========================================
  verifyEmail: async (code: string): Promise<boolean> => {
    const { tokens } = get();

    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({ code }),
        credentials: "include",
      });

      if (!response.ok) {
        return false;
      }

      const user = get().user;
      if (user) {
        set({ user: { ...user, emailVerified: true } });
      }

      return true;
    } catch {
      return false;
    }
  },

  // ========================================
  // FORGOT PASSWORD
  // ========================================
  forgotPassword: async (email: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      return response.ok;
    } catch {
      return false;
    }
  },

  // ========================================
  // RESET PASSWORD
  // ========================================
  resetPassword: async (
    token: string,
    newPassword: string,
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      return response.ok;
    } catch {
      return false;
    }
  },

  // ========================================
  // UPDATE PROFILE
  // ========================================
  updateProfile: async (data: Partial<User>): Promise<boolean> => {
    const { tokens, user } = get();

    if (!tokens?.accessToken || !user) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        return false;
      }

      const updatedUser = await response.json();
      set({ user: { ...user, ...updatedUser } });

      return true;
    } catch {
      return false;
    }
  },

  // ========================================
  // CHECK SESSION
  // ========================================
  checkSession: async (): Promise<boolean> => {
    const { tokens } = get();

    if (!tokens) {
      set({ isInitialized: true });
      return false;
    }

    // Check if token is expired
    if (isTokenExpired(tokens.expiresAt)) {
      // Try to refresh
      const refreshed = await get().refreshSession();
      set({ isInitialized: true });
      return refreshed;
    }

    // Validate token with backend
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        get().signOut();
        set({ isInitialized: true });
        return false;
      }

      const user = await response.json();
      set({ user, isInitialized: true });
      return true;
    } catch {
      set({ isInitialized: true });
      return false;
    }
  },

  // ========================================
  // GET ACCESS TOKEN
  // ========================================
  getAccessToken: (): string | null => {
    const { tokens } = get();

    if (!tokens) {
      return null;
    }

    // Auto-refresh if expired - fire refresh but return null
    // to signal callers that the token is not usable
    if (isTokenExpired(tokens.expiresAt)) {
      get().refreshSession();
      // Return null for expired tokens so callers don't use stale credentials
      return null;
    }

    return tokens.accessToken;
  },
});

// Create the store with persist middleware
// Note: Using type assertion due to zustand middleware type inference issue between persist and temporal
export const useAuthStore = create<AuthState>()(
  persist(authStoreCreator, persistOptions) as unknown as StateCreator<
    AuthState,
    [],
    []
  >,
);

// ============================================
// SELECTORS
// ============================================

export const useIsSignedIn = () =>
  useAuthStore(
    (state) =>
      state.user !== null &&
      state.tokens !== null &&
      !isTokenExpired(state.tokens.expiresAt),
  );

export const useUser = () => useAuthStore((state) => state.user);

export const useUserId = () => useAuthStore((state) => state.user?.id ?? null);

export const useAuthLoading = () => useAuthStore((state) => state.isLoading);

export const useAuthError = () => useAuthStore((state) => state.error);

export default useAuthStore;
