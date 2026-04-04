/**
 * SignUpPage - Clerk Sign Up Page
 * 
 * Uses Clerk for authentication with Premium Navy Theme
 */

import { useEffect, useState } from 'react';
import { ClerkLoaded, ClerkLoading, SignUp } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { colors } from '@/styles/theme';
import { Rocket, Shield, Zap } from 'lucide-react';
import { Logo } from '../components/branding';
import { useAuth } from '../providers/AuthProvider';

export const SignUpPage = () => {
    useEffect(() => { document.title = 'Sign Up | BeamLab'; }, []);
    const { authServiceAvailable } = useAuth();

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
        <div className="min-h-screen bg-[#0b1326] flex font-sans selection:bg-blue-500/30">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#0b1326] border-r border-[#1a2333]">
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
                        <p className="text-lg text-[#a9bcde] max-w-lg leading-relaxed">
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
                                    <h3 className="font-semibold text-[#dae2fd]">Instant Access</h3>
                                    <p className="text-sm text-[#a9bcde] mt-1">No downloads required. Works directly in your browser.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 mt-1">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[#dae2fd]">Enterprise Security</h3>
                                    <p className="text-sm text-[#a9bcde] mt-1">Your data is encrypted and backed up automatically.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-1">
                                    <Rocket className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[#dae2fd]">Always Up to Date</h3>
                                    <p className="text-sm text-[#a9bcde] mt-1">Get the latest analysis codes and features instantly.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-6 text-sm text-[#a9bcde] border-t border-[#1a2333]/50 pt-8">
                        <span>© {new Date().getFullYear()} BeamLab Ultimate</span>
                        <Link to="/privacy" className="hover:text-[#adc6ff] transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-[#adc6ff] transition-colors">Terms</Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Sign Up Form */}
            <main className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#0b1326] overflow-y-auto">
                <div className="w-full max-w-[400px] space-y-8 my-auto">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center mb-8">
                        <Logo size="md" clickable={false} />
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-[#dae2fd]">Create Your Account</h2>
                        <p className="text-[#a9bcde]">
                            Start analyzing structures for free
                        </p>
                    </div>

                    {/* Clerk Sign Up */}
                    <div className="clerk-signup-container" style={{ minHeight: '520px' }}>
                        {!authServiceAvailable ? (
                            <div className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-6 text-[#adc6ff] text-sm space-y-3" role="status" aria-live="polite">
                                <p className="text-base font-semibold text-[#dae2fd]">Authentication temporarily unavailable</p>
                                <p>Local environment cannot load secure auth provider for this origin.</p>
                                <p className="text-[#869ab8]">Please use the configured production domain for sign-up, or set a local Clerk key/origin for development.</p>
                            </div>
                        ) : (
                            <>
                                <ClerkLoading>
                                    <div className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-6 text-[#adc6ff] text-sm space-y-4" aria-live="polite" style={{ minHeight: '500px' }}>
                                        <div className="h-10 w-full bg-[#131b2e] rounded-lg animate-pulse" />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="h-10 bg-[#131b2e] rounded-lg animate-pulse" />
                                            <div className="h-10 bg-[#131b2e] rounded-lg animate-pulse" />
                                        </div>
                                        <div className="h-4 w-16 bg-[#131b2e] rounded animate-pulse" />
                                        <div className="h-10 w-full bg-[#131b2e] rounded-lg animate-pulse" />
                                        <div className="h-4 w-16 bg-[#131b2e] rounded animate-pulse" />
                                        <div className="h-10 w-full bg-[#131b2e] rounded-lg animate-pulse" />
                                        <div className="h-10 w-full bg-[#131b2e] rounded-lg animate-pulse mt-4" />
                                        <p className="text-center text-sm text-[#869ab8]">Loading secure sign-up…</p>
                                    </div>
                                </ClerkLoading>
                                <ClerkLoaded>
                                    <SignUp
                                        appearance={{
                                            elements: {
                                                rootBox: 'w-full',
                                                card: 'bg-[#0b1326] border border-[#1a2333] shadow-xl rounded-xl p-0 overflow-hidden',
                                                headerTitle: 'hidden',
                                                headerSubtitle: 'hidden',
                                                formFieldLabel: 'text-[#adc6ff] font-medium tracking-wide text-sm',
                                                formFieldInput: 'bg-[#131b2e] border-[#1a2333] text-[#dae2fd] placeholder:text-slate-500 dark:placeholder:text-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all',
                                                formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-blue-500/20 transition-all',
                                                footerActionLink: 'text-blue-400 hover:text-blue-300 font-medium tracking-wide',
                                                identityPreviewText: 'text-[#adc6ff]',
                                                identityPreviewEditButton: 'text-blue-400 hover:text-blue-300',
                                                socialButtonsBlockButton: 'bg-[#131b2e] border-[#1a2333] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all',
                                                socialButtonsBlockButtonText: 'font-medium tracking-wide',
                                                dividerLine: 'bg-[#131b2e]',
                                                dividerText: 'text-[#869ab8] uppercase text-xs tracking-wider bg-[#0b1326] px-2',
                                                formFieldInputShowPasswordButton: 'text-slate-600 hover:text-[#adc6ff]',
                                                footer: 'bg-[#0b1326] p-6 border-t border-[#1a2333]'
                                            },
                                            layout: {
                                                socialButtonsPlacement: 'top',
                                                showOptionalFields: false
                                            },
                                            variables: {
                                                colorPrimary: colors.primary[500],
                                                colorText: isDark ? colors.neutral[50] : colors.neutral[900],
                                                colorBackground: isDark ? colors.neutral[900] : colors.neutral[50],
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
                            </>
                        )}
                    </div>

                    {/* Additional Links */}
                    <div className="text-center pt-6">
                        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#adc6ff] transition-colors group">
                            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to home
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SignUpPage;
