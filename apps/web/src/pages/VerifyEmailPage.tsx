/**
 * VerifyEmailPage.tsx - Email Verification Page
 * 
 * Handles email verification during signup
 * User receives a verification code via email and enters it here
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, verifyEmail, isLoading, error } = useAuthStore();

    const [code, setCode] = useState('');
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const email = searchParams.get('email') || user?.email || '';

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
                setTimeout(() => navigate('/app'), 2000);
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
            const response = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (data.success) {
                // Show success message
                setVerifyError(null);
                alert('Verification code resent. Check your email.');
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
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
                    <p className="text-slate-300 mb-6">Your email has been successfully verified.</p>
                    <p className="text-sm text-slate-400">Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <Mail className="w-12 h-12 text-purple-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Verify Email</h1>
                    <p className="text-slate-300">
                        We sent a verification code to<br />
                        <span className="font-semibold text-white">{email}</span>
                    </p>
                </div>

                {/* Error */}
                {(verifyError || error) && (
                    <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex gap-2">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{verifyError || error}</p>
                    </div>
                )}

                {/* Code Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-200 mb-2">
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
                        className="w-full px-4 py-3 text-center text-2xl tracking-widest bg-white/5 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors"
                    />
                    <p className="text-xs text-slate-400 mt-2">
                        Enter the 6-digit code from your email
                    </p>
                </div>

                {/* Verify Button */}
                <button
                    onClick={() => handleVerify()}
                    disabled={isVerifying || code.length !== 6}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isVerifying ? (
                        <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        'Verify Email'
                    )}
                </button>

                {/* Resend Link */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-400 mb-2">Didn't receive the code?</p>
                    <button
                        onClick={handleResend}
                        disabled={isVerifying}
                        className="text-purple-400 hover:text-purple-300 font-medium disabled:opacity-50 transition-colors"
                    >
                        Resend Code
                    </button>
                </div>

                {/* Support Link */}
                <div className="mt-6 pt-6 border-t border-white/10 text-center">
                    <p className="text-xs text-slate-500">
                        Need help?{' '}
                        <a href="/help" className="text-purple-400 hover:text-purple-300">
                            Contact Support
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
