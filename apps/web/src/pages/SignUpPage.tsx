/**
 * SignUpPage - Custom Sign Up Page
 * 
 * Supports both Clerk and In-House authentication
 * Automatically switches based on VITE_USE_CLERK environment variable
 */

import { SignUp } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { isUsingClerk, useAuth } from '../providers/AuthProvider';

// Password strength checker
const checkPasswordStrength = (password: string) => {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    
    const strength = Object.values(checks).filter(Boolean).length;
    return { checks, strength };
};

// In-House Sign Up Form Component
const InHouseSignUpForm = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { signUp } = useAuth();

    const passwordStrength = checkPasswordStrength(formData.password);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (passwordStrength.strength < 4) {
            setError('Password is too weak. Please include uppercase, lowercase, number, and be at least 8 characters.');
            return;
        }

        if (!acceptTerms) {
            setError('Please accept the terms and conditions');
            return;
        }

        setIsLoading(true);

        try {
            const result = await signUp({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName
            });
            if (result.success) {
                navigate('/app');
            } else {
                setError(result.error || 'Failed to create account');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setIsLoading(false);
        }
    };

    const getStrengthColor = () => {
        if (passwordStrength.strength <= 2) return 'bg-red-500';
        if (passwordStrength.strength <= 3) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">First Name</label>
                    <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="John"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Last Name</label>
                    <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Doe"
                        required
                    />
                </div>
            </div>

            {/* Email */}
            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Email Address</label>
                <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="you@example.com"
                    required
                />
            </div>

            {/* Password */}
            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
                <div className="relative">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12"
                        placeholder="Create a strong password"
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
                
                {/* Password Strength Bar */}
                {formData.password && (
                    <div className="mt-2 space-y-2">
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                                <div
                                    key={level}
                                    className={`h-1 flex-1 rounded ${
                                        level <= passwordStrength.strength ? getStrengthColor() : 'bg-zinc-700'
                                    }`}
                                />
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className={passwordStrength.checks.length ? 'text-green-400' : 'text-zinc-500'}>
                                ✓ 8+ characters
                            </span>
                            <span className={passwordStrength.checks.uppercase ? 'text-green-400' : 'text-zinc-500'}>
                                ✓ Uppercase
                            </span>
                            <span className={passwordStrength.checks.lowercase ? 'text-green-400' : 'text-zinc-500'}>
                                ✓ Lowercase
                            </span>
                            <span className={passwordStrength.checks.number ? 'text-green-400' : 'text-zinc-500'}>
                                ✓ Number
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm Password */}
            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Confirm Password</label>
                <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword
                            ? 'border-red-500'
                            : 'border-zinc-700'
                    }`}
                    placeholder="Confirm your password"
                    required
                />
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2">
                <input
                    type="checkbox"
                    id="terms"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                />
                <label htmlFor="terms" className="text-sm text-zinc-400">
                    I agree to the{' '}
                    <a href="/terms" className="text-purple-400 hover:text-purple-300">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-purple-400 hover:text-purple-300">Privacy Policy</a>
                </label>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating account...
                    </span>
                ) : (
                    'Create Account'
                )}
            </button>

            {/* Social Login Divider */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-zinc-900 text-zinc-500">Or sign up with</span>
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

export const SignUpPage = () => {
    const isClerkEnabled = isUsingClerk();
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-zinc-900" />

                {/* Grid Pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                        linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px'
                }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 text-white">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold">
                            ⬡
                        </div>
                        <div>
                            <span className="text-2xl font-bold">BeamLab</span>
                            <span className="ml-2 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">ULTIMATE</span>
                        </div>
                    </div>

                    {/* Tagline */}
                    <div className="space-y-6">
                        <h1 className="text-5xl font-bold leading-tight">
                            Start Building<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                                Amazing Structures
                            </span>
                        </h1>
                        <p className="text-lg text-zinc-400 max-w-md">
                            Join thousands of engineers using BeamLab for professional structural analysis.
                        </p>

                        {/* Benefits */}
                        <div className="space-y-3 pt-4">
                            {[
                                { icon: '✓', label: 'Free tier with 3 daily analyses' },
                                { icon: '✓', label: 'AI-powered structure generation' },
                                { icon: '✓', label: 'Export professional PDF reports' },
                                { icon: '✓', label: 'No credit card required' }
                            ].map((f, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                    <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xs">
                                        {f.icon}
                                    </span>
                                    <span className="text-zinc-300">{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Testimonial */}
                    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50">
                        <p className="text-zinc-300 italic mb-4">
                            "BeamLab has transformed how I approach structural analysis. The AI assistant is incredibly helpful!"
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-bold">
                                SK
                            </div>
                            <div>
                                <p className="font-medium">Structural Engineer</p>
                                <p className="text-sm text-zinc-500">Civil Engineering Professional</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Sign Up Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center text-xl font-bold text-white">
                            ⬡
                        </div>
                        <span className="text-xl font-bold text-white">BeamLab</span>
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
                        <p className="text-zinc-400">
                            Start your free structural analysis journey
                        </p>
                    </div>

                    {/* Conditional: Clerk or In-House Form */}
                    {isClerkEnabled ? (
                        <div className="clerk-signup-container">
                            <SignUp
                                appearance={{
                                    elements: {
                                        rootBox: 'w-full',
                                        card: 'bg-zinc-900/50 border border-zinc-800 shadow-2xl backdrop-blur-sm',
                                        headerTitle: 'text-white',
                                        headerSubtitle: 'text-zinc-400',
                                        formFieldLabel: 'text-zinc-300',
                                        formFieldInput: 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500',
                                        formButtonPrimary: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500',
                                        footerActionLink: 'text-purple-400 hover:text-purple-300',
                                        identityPreviewText: 'text-white',
                                        identityPreviewEditButton: 'text-purple-400',
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
                                path="/sign-up"
                                signInUrl="/sign-in"
                                afterSignUpUrl="/app"
                            />
                        </div>
                    ) : (
                        <InHouseSignUpForm />
                    )}

                    {/* Additional Links */}
                    <div className="text-center space-y-4">
                        <p className="text-zinc-400">
                            Already have an account?{' '}
                            <Link to="/sign-in" className="text-purple-400 hover:text-purple-300 font-medium">
                                Sign in
                            </Link>
                        </p>
                        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-400 flex items-center justify-center gap-2">
                            ← Back to home
                        </Link>
                    </div>

                    {/* Terms - Only show for Clerk since in-house has its own */}
                    {isClerkEnabled && (
                        <p className="text-xs text-zinc-500 text-center">
                            By signing up, you agree to our{' '}
                            <a href="/terms" className="text-zinc-400 hover:text-zinc-300">Terms of Service</a>
                            {' '}and{' '}
                            <a href="/privacy" className="text-zinc-400 hover:text-zinc-300">Privacy Policy</a>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;
