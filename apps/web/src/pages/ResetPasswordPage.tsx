/**
 * ResetPasswordPage.tsx - Password Reset Form
 * Allows users to set a new password with strength validation
 * Uses Clerk for authentication
 */

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check, ArrowLeft, Lock } from 'lucide-react';
import { authLogger } from '../lib/logger';
import { useSignIn } from '@clerk/clerk-react';
import { Button } from '../components/ui/button';
import beamLabLogo from '../assets/beamlab_logo.png';

// ============================================
// PASSWORD STRENGTH CALCULATOR
// ============================================

interface PasswordRequirement {
    label: string;
    met: boolean;
}

const calculatePasswordStrength = (password: string): {
    score: number;
    label: string;
    color: string;
    requirements: PasswordRequirement[];
} => {
    const requirements: PasswordRequirement[] = [
        { label: 'At least 8 characters', met: password.length >= 8 },
        { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
        { label: 'One number', met: /[0-9]/.test(password) },
        { label: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];

    const metCount = requirements.filter(r => r.met).length;
    const score = (metCount / requirements.length) * 100;

    let label = 'Weak';
    let color = 'bg-red-500';

    if (score >= 75) {
        label = 'Strong';
        color = 'bg-green-500';
    } else if (score >= 50) {
        label = 'Medium';
        color = 'bg-yellow-500';
    } else if (score >= 25) {
        label = 'Weak';
        color = 'bg-orange-500';
    }

    return { score, label, color, requirements };
};

// ============================================
// COMPONENT
// ============================================

export const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { signIn, isLoaded } = useSignIn();

    useEffect(() => { document.title = 'Reset Password | BeamLab Ultimate'; }, []);
    
    // Get reset code from URL (sent via email link)
    const resetCode = searchParams.get('code');

    const strength = useMemo(() => calculatePasswordStrength(password), [password]);
    const passwordsMatch = password === confirmPassword && password.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (strength.score < 75 || !passwordsMatch) return;
        if (!isLoaded || !signIn) return;

        setIsSubmitting(true);
        setError(null);
        
        try {
            // Use Clerk's password reset flow
            if (resetCode) {
                // Complete the reset with the code from email
                const result = await signIn.attemptFirstFactor({
                    strategy: 'reset_password_email_code',
                    code: resetCode,
                    password: password,
                });
                
                if (result.status === 'complete') {
                    // Password reset successful, redirect to sign in
                    navigate('/sign-in?reset=success');
                } else {
                    setError('Password reset incomplete. Please try again.');
                }
            } else {
                // No reset code - redirect to forgot password flow
                setError('Invalid reset link. Please request a new password reset.');
            }
        } catch (err) {
            authLogger.error('Password reset error:', err);
            setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 lg:px-10">
                <Link to="/" className="flex items-center gap-3 text-slate-900 dark:text-white">
                    <img src={beamLabLogo} alt="BeamLab" className="w-8 h-8 rounded-lg" />
                    <h2 className="text-lg font-bold tracking-tight">BeamLab Ultimate</h2>
                </Link>
                <Link
                    to="/help"
                    className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                    Contact Support
                </Link>
            </header>

            {/* Main Content */}
            <main className="flex flex-1 justify-center py-10 px-4 sm:px-6">
                <div className="flex flex-col w-full max-w-[512px]">
                    {/* Heading */}
                    <div className="flex flex-col gap-3 pb-6 text-center sm:text-left">
                        <h1 className="text-slate-900 dark:text-white text-3xl sm:text-4xl font-black tracking-tight">
                            Reset Your Password
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-base">
                            Please enter your new password below. Ensure it meets security standards to keep your structural data safe.
                        </p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            {/* Error Message */}
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}
                            {/* New Password Field */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-900 dark:text-white text-base font-medium">
                                    New Password
                                </label>
                                <div className="flex w-full items-stretch rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                    <div className="relative flex-1">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            className="w-full rounded-l-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-blue-500 h-12 pl-12 pr-4 text-base"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="rounded-l-none rounded-r-lg border border-l-0 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 h-12 w-12"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Password Strength */}
                            {password && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <p className="text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                                            Password Strength
                                        </p>
                                        <span className={`text-xs font-bold ${strength.label === 'Strong' ? 'text-green-500' :
                                                strength.label === 'Medium' ? 'text-yellow-500' : 'text-red-500'
                                            }`}>
                                            {strength.label}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <div
                                            className={`h-full ${strength.color} transition-all duration-300 ease-out`}
                                            style={{ width: `${strength.score}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Requirements Checklist */}
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-700">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                    Password must contain:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {strength.requirements.map((req, i) => (
                                        <label key={i} className="flex items-center gap-3">
                                            <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 ${req.met
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                {req.met && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className={`text-sm ${req.met ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                                                }`}>
                                                {req.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Confirm Password Field */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-900 dark:text-white text-base font-medium">
                                    Confirm New Password
                                </label>
                                <div className="flex w-full items-stretch rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                    <div className="relative flex-1">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400" />
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Re-enter new password"
                                            className={`w-full rounded-l-lg border bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none h-12 pl-12 pr-4 text-base ${confirmPassword && !passwordsMatch
                                                    ? 'border-red-500 focus:border-red-500'
                                                    : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'
                                                }`}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="rounded-l-none rounded-r-lg border border-l-0 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 h-12 w-12"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </Button>
                                </div>
                                {confirmPassword && !passwordsMatch && (
                                    <p className="text-red-500 text-sm">Passwords do not match</p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                variant="premium"
                                size="lg"
                                className="w-full mt-2"
                                disabled={strength.score < 75 || !passwordsMatch || isSubmitting}
                            >
                                {isSubmitting ? 'Setting Password...' : 'Set New Password'}
                            </Button>

                            {/* Back Link */}
                            <div className="flex justify-center pt-2">
                                <Link
                                    to="/sign-in"
                                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white transition-colors text-sm font-semibold"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back to Login
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ResetPasswordPage;
