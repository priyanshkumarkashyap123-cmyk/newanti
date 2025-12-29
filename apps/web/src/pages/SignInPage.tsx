/**
 * SignInPage - Custom Sign In Page
 * 
 * Supports both Clerk and In-House authentication
 * Automatically switches based on VITE_USE_CLERK environment variable
 */

import { SignIn } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { isUsingClerk, useAuth } from '../providers/AuthProvider';

// In-House Sign In Form Component
const InHouseSignInForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { signIn } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await signIn(email, password, rememberMe);
            navigate('/app');
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Email Address
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                />
            </div>

            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-zinc-300">
                        Password
                    </label>
                    <Link to="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
                        Forgot password?
                    </Link>
                </div>
                <div className="relative">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                        placeholder="Enter your password"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                    >
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="remember" className="text-sm text-zinc-400">
                    Remember me for 30 days
                </label>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Signing in...
                    </span>
                ) : (
                    'Sign In'
                )}
            </button>

            {/* Social Login Divider */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-zinc-900 text-zinc-500">Or continue with</span>
                </div>
            </div>

            {/* Social Buttons */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                </button>
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    GitHub
                </button>
            </div>
        </form>
    );
};

export const SignInPage = () => {
    const useClerk = isUsingClerk();
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-zinc-900" />

                {/* Grid Pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                        linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px'
                }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 text-white">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl font-bold">
                            ⬡
                        </div>
                        <div>
                            <span className="text-2xl font-bold">BeamLab</span>
                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">ULTIMATE</span>
                        </div>
                    </div>

                    {/* Tagline */}
                    <div className="space-y-6">
                        <h1 className="text-5xl font-bold leading-tight">
                            Welcome back,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                Engineer
                            </span>
                        </h1>
                        <p className="text-lg text-zinc-400 max-w-md">
                            Continue building amazing structures with professional-grade analysis tools.
                        </p>

                        {/* Features */}
                        <div className="grid grid-cols-2 gap-4 pt-4">
                            {[
                                { icon: '📊', label: '3D Analysis' },
                                { icon: '📐', label: 'IS 456 Codes' },
                                { icon: '🤖', label: 'AI Assistant' },
                                { icon: '📄', label: 'PDF Reports' }
                            ].map((f, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                                    <span className="text-lg">{f.icon}</span>
                                    <span>{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-sm text-zinc-500">
                        © 2024 BeamLab Ultimate. Professional Structural Analysis.
                    </p>
                </div>

                {/* 3D Structure Illustration */}
                <div className="absolute bottom-0 right-0 w-96 h-96 opacity-30">
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                        <g stroke="url(#gradient)" fill="none" strokeWidth="1">
                            <line x1="20" y1="180" x2="180" y2="180" />
                            <line x1="20" y1="180" x2="20" y2="60" />
                            <line x1="180" y1="180" x2="180" y2="60" />
                            <line x1="20" y1="60" x2="180" y2="60" />
                            <line x1="100" y1="180" x2="100" y2="60" />
                            <line x1="20" y1="120" x2="180" y2="120" />
                        </g>
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>

            {/* Right Side - Sign In Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl font-bold text-white">
                            ⬡
                        </div>
                        <span className="text-xl font-bold text-white">BeamLab</span>
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
                        <p className="text-zinc-400">
                            Access your structural projects and analysis
                        </p>
                    </div>

                    {/* Conditional: Clerk or In-House Form */}
                    {useClerk ? (
                        <div className="clerk-signin-container">
                            <SignIn
                                appearance={{
                                    elements: {
                                        rootBox: 'w-full',
                                        card: 'bg-zinc-900/50 border border-zinc-800 shadow-2xl backdrop-blur-sm',
                                        headerTitle: 'text-white',
                                        headerSubtitle: 'text-zinc-400',
                                        formFieldLabel: 'text-zinc-300',
                                        formFieldInput: 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500',
                                        formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500',
                                        footerActionLink: 'text-blue-400 hover:text-blue-300',
                                        identityPreviewText: 'text-white',
                                        identityPreviewEditButton: 'text-blue-400',
                                        socialButtonsBlockButton: 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700',
                                        socialButtonsBlockButtonText: 'text-white',
                                        dividerLine: 'bg-zinc-700',
                                        dividerText: 'text-zinc-500',
                                        formFieldInputShowPasswordButton: 'text-zinc-400',
                                        otpCodeFieldInput: 'bg-zinc-800 border-zinc-700 text-white'
                                    },
                                    layout: {
                                        socialButtonsPlacement: 'bottom',
                                        showOptionalFields: false
                                    }
                                }}
                                routing="path"
                                path="/sign-in"
                                signUpUrl="/sign-up"
                                afterSignInUrl="/app"
                            />
                        </div>
                    ) : (
                        <InHouseSignInForm />
                    )}

                    {/* Additional Links */}
                    <div className="text-center space-y-4">
                        <p className="text-zinc-400">
                            Don't have an account?{' '}
                            <Link to="/sign-up" className="text-blue-400 hover:text-blue-300 font-medium">
                                Sign up for free
                            </Link>
                        </p>
                        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-400 flex items-center justify-center gap-2">
                            ← Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
