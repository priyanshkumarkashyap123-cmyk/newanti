/**
 * InHouseSignUp.tsx - Custom Sign Up Page
 * 
 * In-house authentication registration form with:
 * - Full name, email, password fields
 * - Password strength indicator
 * - Terms acceptance
 * - Email verification flow
 */

import React, { useState, FormEvent, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Mail,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    ArrowLeft,
    User,
    Building2,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { type SignUpData } from '../../store/authStore';

// Password strength checker
const checkPasswordStrength = (password: string): {
    score: number;
    label: string;
    color: string;
    checks: { label: string; passed: boolean }[];
} => {
    const checks = [
        { label: 'At least 8 characters', passed: password.length >= 8 },
        { label: 'Contains uppercase letter', passed: /[A-Z]/.test(password) },
        { label: 'Contains lowercase letter', passed: /[a-z]/.test(password) },
        { label: 'Contains number', passed: /[0-9]/.test(password) },
        { label: 'Contains special character', passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
    ];

    const score = checks.filter(c => c.passed).length;

    let label = 'Very Weak';
    let color = 'bg-red-500';

    if (score >= 5) {
        label = 'Strong';
        color = 'bg-green-500';
    } else if (score >= 4) {
        label = 'Good';
        color = 'bg-blue-500';
    } else if (score >= 3) {
        label = 'Fair';
        color = 'bg-yellow-500';
    } else if (score >= 2) {
        label = 'Weak';
        color = 'bg-orange-500';
    }

    return { score, label, color, checks };
};

export const InHouseSignUp: React.FC = () => {
    const navigate = useNavigate();
    const { signUp, isLoaded } = useAuth();

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [company, setCompany] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Password strength
    const passwordStrength = useMemo(() => checkPasswordStrength(password), [password]);

    // Validation
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }

        if (!lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (passwordStrength.score < 3) {
            newErrors.password = 'Password is too weak';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (!acceptTerms) {
            newErrors.terms = 'You must accept the terms and conditions';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const signUpData: SignUpData = {
                email,
                password,
                firstName,
                lastName,
                company: company || undefined
            };

            const result = await signUp(signUpData);

            if (result.success) {
                // Redirect to app or verification page
                navigate('/app?welcome=true');
            } else {
                setError(result.error || 'Sign up failed. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-800 to-slate-50 dark:to-slate-900">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-800 to-slate-50 dark:to-slate-900">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
                <div className="w-full max-w-md py-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <span className="text-4xl">⬡</span>
                        <span className="text-2xl font-bold text-[#dae2fd]">BeamLab</span>
                    </div>

                    {/* Back Link */}
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-[#869ab8] hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">Back to home</span>
                    </Link>

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-[#dae2fd] mb-2">Create your account</h1>
                        <p className="text-[#869ab8]">
                            Already have an account?{' '}
                            <Link to="/sign-in" className="text-blue-400 hover:text-blue-300 transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-400 font-medium tracking-wide">Registration failed</p>
                                <p className="text-red-400/80 text-sm mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Sign Up Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                                    First name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                                    <input
                                        id="firstName"
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className={`w-full pl-11 pr-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border rounded-lg text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors.firstName ? 'border-red-500' : 'border-[#1a2333]'
                                            }`}
                                        placeholder="John"
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.firstName && (
                                    <p className="mt-1 text-sm text-red-400">{errors.firstName}</p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                                    Last name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                                    <input
                                        id="lastName"
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className={`w-full pl-11 pr-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border rounded-lg text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors.lastName ? 'border-red-500' : 'border-[#1a2333]'
                                            }`}
                                        placeholder="Doe"
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.lastName && (
                                    <p className="mt-1 text-sm text-red-400">{errors.lastName}</p>
                                )}
                            </div>
                        </div>

                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                                Email address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`w-full pl-11 pr-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border rounded-lg text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors.email ? 'border-red-500' : 'border-[#1a2333]'
                                        }`}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                            )}
                        </div>

                        {/* Company Field (Optional) */}
                        <div>
                            <label htmlFor="company" className="block text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                                Company <span className="text-[#869ab8]">(optional)</span>
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                                <input
                                    id="company"
                                    type="text"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border border-[#1a2333] rounded-lg text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="Your company"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`w-full pl-11 pr-12 py-3 bg-slate-100/50 dark:bg-slate-800/50 border rounded-lg text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors.password ? 'border-red-500' : 'border-[#1a2333]'
                                        }`}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            {/* Password Strength Indicator */}
                            {password && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${passwordStrength.color}`}
                                                style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-medium tracking-wide ${passwordStrength.score >= 3 ? 'text-green-400' : 'text-yellow-400'
                                            }`}>
                                            {passwordStrength.label}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        {passwordStrength.checks.map((check, i) => (
                                            <div key={i} className="flex items-center gap-1 text-xs">
                                                {check.passed ? (
                                                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 text-[#869ab8]" />
                                                )}
                                                <span className={check.passed ? 'text-green-400' : 'text-[#869ab8]'}>
                                                    {check.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {errors.password && (
                                <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                            )}
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                                Confirm password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`w-full pl-11 pr-12 py-3 bg-slate-100/50 dark:bg-slate-800/50 border rounded-lg text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors.confirmPassword ? 'border-red-500' : 'border-[#1a2333]'
                                        }`}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
                            )}
                        </div>

                        {/* Terms Checkbox */}
                        <div className="flex items-start">
                            <input
                                id="terms"
                                type="checkbox"
                                checked={acceptTerms}
                                onChange={(e) => setAcceptTerms(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded border-[#1a2333] bg-[#131b2e] text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                                disabled={isLoading}
                            />
                            <label htmlFor="terms" className="ml-2 text-sm text-[#869ab8]">
                                I agree to the{' '}
                                <Link to="/terms" className="text-blue-400 hover:text-blue-300">
                                    Terms of Service
                                </Link>{' '}
                                and{' '}
                                <Link to="/privacy" className="text-blue-400 hover:text-blue-300">
                                    Privacy Policy
                                </Link>
                            </label>
                        </div>
                        {errors.terms && (
                            <p className="text-sm text-red-400">{errors.terms}</p>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !acceptTerms}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium tracking-wide rounded-lg hover:from-blue-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                'Create account'
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Right Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 p-12 flex-col justify-between">
                <div>
                    <Link to="/" className="flex items-center gap-3 text-[#dae2fd]">
                        <span className="text-4xl">⬡</span>
                        <span className="text-2xl font-bold">BeamLab</span>
                        <span className="text-xs font-bold px-2 py-1 bg-white/20 rounded">
                            ULTIMATE
                        </span>
                    </Link>
                </div>

                <div className="text-[#dae2fd]">
                    <h2 className="text-4xl font-bold mb-4">
                        Start Engineering Smarter
                    </h2>
                    <p className="text-xl text-slate-900/80 dark:text-white/80 mb-8">
                        Join thousands of structural engineers using BeamLab for faster, more accurate designs.
                    </p>

                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-white/10 rounded-xl">
                            <div className="text-3xl font-bold">10k+</div>
                            <div className="text-sm text-slate-900/60 dark:text-white/60">Engineers</div>
                        </div>
                        <div className="p-4 bg-white/10 rounded-xl">
                            <div className="text-3xl font-bold">50k+</div>
                            <div className="text-sm text-slate-900/60 dark:text-white/60">Projects</div>
                        </div>
                        <div className="p-4 bg-white/10 rounded-xl">
                            <div className="text-3xl font-bold">99.9%</div>
                            <div className="text-sm text-slate-900/60 dark:text-white/60">Uptime</div>
                        </div>
                    </div>
                </div>

                <div className="text-slate-900/60 dark:text-white/60 text-sm">
                    © {new Date().getFullYear()} BeamLab Ultimate. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default InHouseSignUp;
