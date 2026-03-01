/**
 * SignInPage - Clerk Sign In Page
 * 
 * Uses Clerk for authentication with Premium Navy Theme
 */

import { useEffect } from 'react';
import { ClerkLoaded, ClerkLoading, SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { Cpu, CheckCircle, Star, Building2 } from 'lucide-react';
import { Button } from '../components/ui/button';

export const SignInPage = () => {
    useEffect(() => { document.title = 'Sign In | BeamLab Ultimate'; }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex font-sans selection:bg-blue-500/30">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-slate-100 dark:via-slate-900 to-white dark:to-slate-950" />
                    <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
                </div>

                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `
                        linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-16 text-slate-900 dark:text-slate-50 w-full">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group w-fit">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-blue-500/25 transition-all">
                            <Cpu className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">BeamLab</span>
                            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full tracking-wide">ULTIMATE</span>
                        </div>
                    </Link>

                    {/* 3D Model Preview - per Figma §4.1 */}
                    <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                        <div className="w-full max-w-sm aspect-square rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-gradient-to-br from-slate-100 dark:from-slate-800/50 to-slate-200 dark:to-slate-900/80 shadow-xl flex items-center justify-center overflow-hidden relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
                            <Building2 className="w-24 h-24 text-slate-300 dark:text-slate-600 animate-pulse" />
                            <div className="absolute bottom-3 right-3 px-2 py-1 bg-slate-900/60 backdrop-blur-sm rounded text-[10px] text-slate-300 font-mono">
                                3D Preview
                            </div>
                        </div>

                        {/* Tagline */}
                        <h1 className="text-3xl font-bold leading-tight text-center">
                            Analyze structures{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                10x faster with AI
                            </span>
                        </h1>

                        {/* Star Rating - per Figma §4.1 */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                                ))}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                <span className="font-semibold text-slate-900 dark:text-white">4.9/5</span> rating from{' '}
                                <span className="font-semibold text-slate-900 dark:text-white">2,000+</span> engineers
                            </p>
                        </div>
                    </div>

                    {/* Client Logos - per Figma §4.1 */}
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-800/50">
                        <div className="flex items-center justify-center gap-8">
                            {['L&T', 'Tata Projects', 'AECOM'].map((name) => (
                                <div
                                    key={name}
                                    className="px-4 py-2 text-sm font-semibold text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-100 transition-opacity cursor-default"
                                >
                                    {name}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Sign In Form */}
            <main className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-950 overflow-y-auto">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900 dark:text-white">BeamLab Ultimate</span>
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome Back</h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Sign in to your account
                        </p>
                    </div>

                    {/* Clerk Sign In */}
                    <div className="clerk-signin-container" style={{ minHeight: '420px' }}>
                        <ClerkLoading>
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-700 dark:text-slate-300 text-sm space-y-4" aria-live="polite" style={{ minHeight: '400px' }}>
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse mt-4" />
                                <p className="text-center text-sm text-slate-600 dark:text-slate-400">Loading secure sign-in…</p>
                            </div>
                        </ClerkLoading>
                        <ClerkLoaded>
                            <SignIn
                                appearance={{
                                    elements: {
                                        rootBox: 'w-full',
                                        card: 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl p-0 overflow-hidden',
                                        headerTitle: 'hidden', // We have our own header
                                        headerSubtitle: 'hidden',
                                        formFieldLabel: 'text-slate-700 dark:text-slate-300 font-medium text-sm',
                                        formFieldInput: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all',
                                        formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-blue-500/20 transition-all',
                                        footerActionLink: 'text-blue-400 hover:text-blue-300 font-medium',
                                        identityPreviewText: 'text-slate-700 dark:text-slate-300',
                                        identityPreviewEditButton: 'text-blue-400 hover:text-blue-300',
                                        socialButtonsBlockButton: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all',
                                        socialButtonsBlockButtonText: 'font-medium',
                                        dividerLine: 'bg-slate-100 dark:bg-slate-800',
                                        dividerText: 'text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider bg-slate-50 dark:bg-slate-900 px-2',
                                        formFieldInputShowPasswordButton: 'text-slate-600 hover:text-slate-700 dark:text-slate-300',
                                        otpCodeFieldInput: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-center font-mono font-bold text-lg focus:ring-blue-500',
                                        footer: 'bg-slate-50 dark:bg-slate-900/50 p-6 border-t border-slate-200 dark:border-slate-800'
                                    },
                                    layout: {
                                        socialButtonsPlacement: 'top',
                                        showOptionalFields: false
                                    },
                                    variables: {
                                        colorPrimary: '#3b82f6',
                                        colorText: '#f8fafc',
                                        colorBackground: '#0f172a',
                                        fontFamily: 'Inter, sans-serif',
                                        borderRadius: '0.5rem'
                                    }
                                }}
                                routing="path"
                                path="/sign-in"
                                signUpUrl="/sign-up"
                                forceRedirectUrl="/app"
                            />
                        </ClerkLoaded>
                    </div>

                    {/* Additional Links */}
                    <div className="text-center pt-6">
                        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-700 dark:text-slate-300 transition-colors group">
                            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to home
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SignInPage;
