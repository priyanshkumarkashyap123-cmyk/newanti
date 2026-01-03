/**
 * SignUpPage - Clerk Sign Up Page
 * 
 * Uses Clerk for authentication
 */

import { useState } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Link, useSearchParams } from 'react-router-dom';

export const SignUpPage = () => {
    const [searchParams] = useSearchParams();
    const [agreed, setAgreed] = useState(false);
    const [consented, setConsented] = useState(false);

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

                    {/* Clerk Sign Up */}
                    <div className="clerk-signup-container">
                        {!consented ? (
                            <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 backdrop-blur-sm shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-4">Legal Consent Required</h3>
                                <p className="text-zinc-400 mb-6 text-sm">
                                    Before creating an account, you must agree to our legal terms regarding the use of this engineering software.
                                </p>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                                        <input
                                            type="checkbox"
                                            id="terms-check"
                                            className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
                                            checked={agreed}
                                            onChange={(e) => setAgreed(e.target.checked)}
                                        />
                                        <label htmlFor="terms-check" className="text-sm text-zinc-300 cursor-pointer select-none">
                                            I agree to the <Link to="/terms" className="text-blue-400 hover:text-blue-300 hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-blue-400 hover:text-blue-300 hover:underline">Privacy Policy</Link>. I understand this software is a computational aid only.
                                        </label>
                                    </div>
                                </div>

                                <button
                                    onClick={() => agreed && setConsented(true)}
                                    disabled={!agreed}
                                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${agreed
                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/20'
                                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                        }`}
                                >
                                    Continue to Sign Up
                                </button>
                            </div>
                        ) : (
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
                                forceRedirectUrl={searchParams.get('plan') === 'pro' ? '/app?upgrade=pro' : '/app'}
                            />
                        )}
                    </div>

                    {/* Additional Links */}
                    <div className="text-center space-y-4 pt-4">
                        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-400 flex items-center justify-center gap-2">
                            ← Back to home
                        </Link>
                    </div>

                    {/* Terms */}
                    <p className="text-xs text-zinc-500 text-center">
                        By signing up, you agree to our{' '}
                        <a href="/terms" className="text-zinc-400 hover:text-zinc-300">Terms of Service</a>
                        {' '}and{' '}
                        <a href="/privacy" className="text-zinc-400 hover:text-zinc-300">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;
