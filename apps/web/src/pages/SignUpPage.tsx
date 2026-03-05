/**
 * SignUpPage - Clerk Sign Up Page
 * 
 * Uses Clerk for authentication with Premium Navy Theme
 */

import { useEffect, useState } from 'react';
import { ClerkLoaded, ClerkLoading, SignUp } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { Rocket, Shield, Zap } from 'lucide-react';
import { Logo } from '../components/branding';

export const SignUpPage = () => {
    useEffect(() => { document.title = 'Sign Up | BeamLab'; }, []);

    // Reactive dark mode detection for Clerk variables
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex font-sans selection:bg-blue-500/30">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-slate-100 dark:via-slate-900 to-white dark:to-slate-950" />
                    <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-16 text-slate-900 dark:text-slate-50 w-full">
                    {/* Logo */}
                    <Logo size="lg" href="/" />

                    {/* Tagline */}
                    <div className="space-y-8">
                        <h1 className="text-5xl font-bold leading-tight">
                            Start designing <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                in seconds.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
                            Join thousands of engineers building better structures with BeamLab.
                            Free to start, powerful enough to scale.
                        </p>

                        {/* Benefits */}
                        <div className="grid grid-cols-1 gap-6 pt-4">
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 mt-1">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Instant Access</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">No downloads required. Works directly in your browser.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 mt-1">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Enterprise Security</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Your data is encrypted and backed up automatically.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-1">
                                    <Rocket className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Always Up to Date</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Get the latest analysis codes and features instantly.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/50 pt-8">
                        <span>© {new Date().getFullYear()} BeamLab</span>
                        <Link to="/privacy" className="hover:text-slate-700 dark:text-slate-300 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-slate-700 dark:text-slate-300 transition-colors">Terms</Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Sign Up Form */}
            <main className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-950 overflow-y-auto">
                <div className="w-full max-w-[400px] space-y-8 my-auto">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center mb-8">
                        <Logo size="md" clickable={false} />
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Create Your Account</h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Start analyzing structures for free
                        </p>
                    </div>

                    {/* Clerk Sign Up */}
                    <div className="clerk-signup-container" style={{ minHeight: '520px' }}>
                        <ClerkLoading>
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-700 dark:text-slate-300 text-sm space-y-4" aria-live="polite" style={{ minHeight: '500px' }}>
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                    <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                </div>
                                <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse mt-4" />
                                <p className="text-center text-sm text-slate-600 dark:text-slate-400">Loading secure sign-up…</p>
                            </div>
                        </ClerkLoading>
                        <ClerkLoaded>
                            <SignUp
                                appearance={{
                                    elements: {
                                        rootBox: 'w-full',
                                        card: 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl p-0 overflow-hidden',
                                        headerTitle: 'hidden',
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
                                        footer: 'bg-slate-50 dark:bg-slate-900/50 p-6 border-t border-slate-200 dark:border-slate-800'
                                    },
                                    layout: {
                                        socialButtonsPlacement: 'top',
                                        showOptionalFields: false
                                    },
                                    variables: {
                                        colorPrimary: '#3b82f6',
                                        colorText: isDark ? '#f8fafc' : '#0f172a',
                                        colorBackground: isDark ? '#0f172a' : '#f8fafc',
                                        fontFamily: 'Inter, sans-serif',
                                        borderRadius: '0.5rem'
                                    }
                                }}
                                routing="path"
                                path="/sign-up"
                                signInUrl="/sign-in"
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

export default SignUpPage;
