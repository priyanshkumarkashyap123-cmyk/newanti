/**
 * VerifyEmailPage.tsx - Email Verification Page
 * 
 * Handles email verification during signup
 * User receives a verification code via email and enters it here
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { API_CONFIG } from '../config/env';

export const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, verifyEmail, isLoading, error } = useAuthStore();

    const [code, setCode] = useState('');
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const email = searchParams.get('email') || user?.email || '';

    const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { document.title = 'Verify Email | BeamLab'; }, []);

    useEffect(() => {
      return () => {
        if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
        if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
      };
    }, []);

    // Auto-fill code if provided in URL
    useEffect(() => {
        const urlCode = searchParams.get('code');
        if (urlCode) {
            setCode(urlCode);
            handleVerify(urlCode);
        }
    }, [searchParams]);

    const handleVerify = async (verificationCode: string = code) => {
        if (!verificationCode || verificationCode.length !== 6) {
            setVerifyError('Please enter a valid 6-digit code');
            return;
        }

        setIsVerifying(true);
        setVerifyError(null);

        try {
            const success = await verifyEmail(verificationCode);
            if (success) {
                setIsVerified(true);
                // Redirect to app after 2 seconds
                navigateTimerRef.current = setTimeout(() => navigate('/app'), 2000);
            } else {
                setVerifyError('Invalid verification code. Please try again.');
            }
        } catch (err) {
            setVerifyError('Failed to verify email. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            setVerifyError('Email address not found');
            return;
        }

        setIsVerifying(true);
        setVerifyError(null);

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/api/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (data.success) {
                setResendSuccess(true);
                resendTimerRef.current = setTimeout(() => setResendSuccess(false), 5000);
            } else {
                setVerifyError(data.message || 'Failed to resend code');
            }
        } catch (err) {
            setVerifyError('Failed to resend code. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    if (isVerified) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-blue-100 dark:via-blue-900 to-slate-50 dark:to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Email Verified!</h2>
                    <p className="text-slate-700 dark:text-slate-300 mb-6">Your email has been successfully verified.</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-blue-100 dark:via-blue-900 to-slate-50 dark:to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <Mail className="w-12 h-12 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Verify Email</h1>
                    <p className="text-slate-700 dark:text-slate-300">
                        We sent a verification code to<br />
                        <span className="font-semibold text-slate-900 dark:text-white">{email}</span>
                    </p>
                </div>

                {/* Error */}
                {(verifyError || error) && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-600 dark:text-red-400">{verifyError || error}</p>
                    </div>
                )}

                {/* Code Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                        Verification Code
                    </label>
                    <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setCode(value);
                        }}
                        className="w-full px-4 py-3 text-center text-2xl tracking-widest bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                        Enter the 6-digit code from your email
                    </p>
                </div>

                {/* Verify Button */}
                <Button
                    variant="premium"
                    size="lg"
                    className="w-full"
                    onClick={() => handleVerify()}
                    disabled={isVerifying || code.length !== 6}
                >
                    {isVerifying ? (
                        <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        'Verify Email'
                    )}
                </Button>

                {/* Resend Link */}
                <div className="mt-6 text-center">
                    {resendSuccess && (
                        <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <p className="text-sm text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Verification code resent. Check your email.
                            </p>
                        </div>
                    )}
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Didn't receive the code?</p>
                    <Button
                        variant="outline"
                        onClick={handleResend}
                        disabled={isVerifying}
                    >
                        Resend Code
                    </Button>
                </div>

                {/* Support Link */}
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        Need help?{' '}
                        <Link to="/help" className="text-blue-400 hover:text-blue-300">
                            Contact Support
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
