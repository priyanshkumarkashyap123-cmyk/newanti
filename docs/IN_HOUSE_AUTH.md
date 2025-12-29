# In-House Authentication System

## Overview

This document describes the in-house authentication system that can be used as an alternative to Clerk authentication. The system is designed to work alongside Clerk, with a simple environment variable switch to choose which authentication provider to use.

## Environment Variables

### Frontend (.env)
```bash
# Set to 'true' to use Clerk, 'false' or remove to use in-house auth
VITE_USE_CLERK=true
VITE_CLERK_PUBLISHABLE_KEY=pk_your_clerk_key_here

# API URL
VITE_API_URL=http://localhost:3001
```

### Backend (.env)
```bash
# Set to 'true' to use Clerk, 'false' or remove to use in-house auth
USE_CLERK=true
CLERK_SECRET_KEY=sk_your_clerk_secret_here

# JWT Secrets (required for in-house auth)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-at-least-32-chars

# MongoDB
MONGODB_URI=mongodb://localhost:27017/beamlab
```

## Switching Between Auth Providers

### To use Clerk (default):
```bash
# Frontend
VITE_USE_CLERK=true

# Backend
USE_CLERK=true
```

### To use In-House Auth:
```bash
# Frontend
VITE_USE_CLERK=false  # or remove the variable

# Backend
USE_CLERK=false  # or remove the variable
```

## Architecture

### Frontend Components

1. **AuthProvider** (`src/providers/AuthProvider.tsx`)
   - Unified auth context that wraps the entire app
   - Automatically switches between Clerk and in-house auth based on `VITE_USE_CLERK`
   - Exports unified hooks: `useAuth`, `useUser`, `useIsSignedIn`

2. **Auth Store** (`src/store/authStore.ts`)
   - Zustand store for in-house auth state management
   - Persists tokens to localStorage
   - Handles token refresh automatically

3. **Auth Service** (`src/services/AuthService.ts`)
   - API wrapper for all auth endpoints
   - Handles token management

4. **Auth Pages**
   - `SignInPage.tsx` - Sign in with email/password
   - `SignUpPage.tsx` - Registration with password strength indicator
   - `ForgotPasswordPage.tsx` - Password reset request

### Backend Components

1. **Auth Routes** (`src/routes/authRoutes.ts`)
   - `/api/auth/signup` - Register new user
   - `/api/auth/signin` - Sign in and get tokens
   - `/api/auth/signout` - Revoke refresh token
   - `/api/auth/refresh` - Refresh access token
   - `/api/auth/me` - Get current user
   - `/api/auth/verify-email` - Email verification
   - `/api/auth/forgot-password` - Request password reset
   - `/api/auth/reset-password` - Reset password with token
   - `/api/auth/change-password` - Change password (authenticated)
   - `/api/auth/profile` - Update user profile

2. **Auth Middleware** (`src/middleware/authMiddleware.ts`)
   - Unified middleware that handles both Clerk and JWT tokens
   - Automatically detects token type and validates accordingly

3. **Database Models** (`src/models.ts`)
   - `UserModel` - User accounts
   - `RefreshTokenModel` - Refresh tokens with expiry
   - `VerificationCodeModel` - Email verification and password reset codes

## Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: 
  - Access token: 15 minutes
  - Refresh token: 7 days (30 days with "remember me")
- **Token Refresh**: Automatic client-side refresh before expiry
- **Password Requirements**: 
  - Minimum 8 characters
  - Must contain uppercase, lowercase, and number
- **Rate Limiting**: Built-in protection for auth endpoints
- **Token Revocation**: Refresh tokens stored in DB for revocation

## Usage in Components

### Before (Clerk-only):
```tsx
import { useAuth } from '@clerk/clerk-react';

const MyComponent = () => {
    const { isSignedIn, userId } = useAuth();
    // ...
};
```

### After (Unified):
```tsx
import { useAuth, useIsSignedIn } from '../providers/AuthProvider';

const MyComponent = () => {
    const { isSignedIn, userId, signIn, signOut } = useAuth();
    // OR
    const isSignedIn = useIsSignedIn();
    // ...
};
```

## API Usage

### Sign Up
```typescript
const { signUp } = useAuth();
await signUp(email, password, firstName, lastName);
```

### Sign In
```typescript
const { signIn } = useAuth();
await signIn(email, password, rememberMe);
```

### Sign Out
```typescript
const { signOut } = useAuth();
await signOut();
```

### Get Auth Token (for API calls)
```typescript
const { getToken } = useAuth();
const token = await getToken();

fetch('/api/protected', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

## Roadmap to Full In-House Auth

To fully bypass Clerk:

1. ✅ Create in-house auth store and service
2. ✅ Create unified AuthProvider
3. ✅ Update all components to use unified hooks
4. ✅ Create backend auth routes
5. ✅ Create unified auth middleware
6. ⏳ Add email sending for verification (optional)
7. ⏳ Add OAuth providers (Google, GitHub) (optional)
8. ⏳ Add 2FA support (optional)

Once all features are complete, simply set `VITE_USE_CLERK=false` and `USE_CLERK=false` to switch entirely to in-house auth.
