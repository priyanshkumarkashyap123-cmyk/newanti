/**
 * ForgotPasswordPage - Password Reset Request Page
 * 
 * Supports both Clerk and In-House authentication
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { isUsingClerk, useAuth } from '../providers/AuthProvider';
import { getErrorMessage } from '../lib/errorHandling';
import { Button } from '../components/ui/button';
import { Cpu, ArrowLeft } from 'lucide-react';

export const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const { forgotPassword } = useAuth();
    const isClerkEnabled = isUsingClerk();

    useEffect(() => { document.title = 'Forgot Password | BeamLab'; }, []);

    // If using Clerk, redirect to Clerk's forgot password
    if (isClerkEnabled) {
        // Clerk handles this through its own UI
        window.location.href = '/sign-in#/forgot-password';
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await forgotPassword(email);
            setSuccess(true);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to send reset email'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-white dark:from-slate-950 via-slate-100 dark:via-slate-900 to-white dark:to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Cpu className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">BeamLab</span>
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">ULTIMATE</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
                    {success ? (
                        // Success State
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Check Your Email</h2>
                            <p className="text-slate-500 dark:text-slate-400">
                                We've sent a password reset link to <span className="text-slate-900 dark:text-white font-medium">{email}</span>
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Didn't receive the email? Check your spam folder or{' '}
                                <Button 
                                    variant="link"
                                    onClick={() => setSuccess(false)} 
                                    className="text-blue-400 hover:text-blue-300 p-0 h-auto inline"
                                >
                                    try again
                                </Button>
                            </p>
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full"
                                onClick={() => navigate('/sign-in')}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Sign In
                            </Button>
                        </div>
                    ) : (
                        // Form State
                        <>
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Forgot Password?</h2>
                                <p className="text-slate-500 dark:text-slate-400">
                                    No worries! Enter your email and we'll send you a reset link.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="premium"
                                    size="lg"
                                    className="w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Sending...
                                        </span>
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link to="/sign-in" className="text-blue-400 hover:text-blue-300 text-sm flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Back to Sign In
                                </Link>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-8">
                    © {new Date().getFullYear()} BeamLab. Professional Structural Analysis.
                </p>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
