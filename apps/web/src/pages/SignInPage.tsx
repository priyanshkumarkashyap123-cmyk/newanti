/**
 * SignInPage - Clerk Sign In Page
 * 
 * Uses Clerk for authentication with Premium Navy Theme
 */

import { useEffect, useState } from 'react';
import { ClerkLoaded, ClerkLoading, SignIn } from '@clerk/clerk-react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Star, Building2 } from 'lucide-react';
import { Logo } from '../components/branding';

export const SignInPage = () => {
    useEffect(() => { document.title = 'Sign In | BeamLab'; }, []);

    const [searchParams] = useSearchParams();
    // Read destination from ?redirect= query param (set by RequireAuth on session expiry)
    const rawRedirect = searchParams.get('redirect') || '/app';
    // Validate: must be a relative path (not protocol-relative or absolute URL)
    const redirectUrl = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/app';

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
        <div className="min-h-screen bg-[#070f1f] flex font-sans selection:bg-blue-500/30">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#070f1f] border-r border-[#24314d]">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-[#0c162b] to-[#070f1f]" />
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
                <div className="relative z-10 flex flex-col justify-between p-16 text-[#e8efff] w-full">
                    {/* Logo */}
                    <Logo size="lg" href="/" />

                    {/* 3D Model Preview - per Figma §4.1 */}
                    <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                        <div className="w-full max-w-sm aspect-square rounded-2xl border border-[#2d3b58]/70 bg-gradient-to-br from-[#111c34] to-[#0b1326] shadow-xl flex items-center justify-center overflow-hidden relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
                            <Building2 className="w-24 h-24 text-[#8ca1c8] animate-pulse" />
                            <div className="absolute bottom-3 right-3 px-2 py-1 bg-[#060c1c]/80 backdrop-blur-sm rounded text-[10px] text-[#d1def6] font-mono">
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
                            <p className="text-sm text-[#a9bcde]">
                                <span className="font-semibold text-[#ecf3ff]">4.9/5</span> rating from{' '}
                                <span className="font-semibold text-[#ecf3ff]">2,000+</span> engineers
                            </p>
                        </div>
                    </div>

                    {/* Client Logos - per Figma §4.1 */}
                    <div className="pt-6 border-t border-[#2a3855]/60">
                        <div className="flex items-center justify-center gap-8">
                            {['L&T', 'Tata Projects', 'AECOM'].map((name) => (
                                <div
                                    key={name}
                                    className="px-4 py-2 text-sm font-semibold text-[#8ea4c9] opacity-70 hover:opacity-100 transition-opacity cursor-default"
                                >
                                    {name}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Sign In Form */}
            <main className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#070f1f] overflow-y-auto">
                <div className="w-full max-w-[400px] space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center mb-8">
                        <Logo size="md" clickable={false} />
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-[#ecf3ff]">Welcome Back</h2>
                        <p className="text-[#a9bcde]">
                            Sign in to your account
                        </p>
                    </div>

                    {/* Clerk Sign In */}
                    <div className="clerk-signin-container" style={{ minHeight: '420px' }}>
                        <ClerkLoading>
                            <div className="bg-[#0b1326] border border-[#2b3a57] rounded-xl p-6 text-[#c6d7f6] text-sm space-y-4" aria-live="polite" style={{ minHeight: '400px' }}>
                                <div className="h-10 w-full bg-[#16213a] rounded-lg animate-pulse" />
                                <div className="h-4 w-16 bg-[#16213a] rounded animate-pulse" />
                                <div className="h-10 w-full bg-[#16213a] rounded-lg animate-pulse" />
                                <div className="h-4 w-16 bg-[#16213a] rounded animate-pulse" />
                                <div className="h-10 w-full bg-[#16213a] rounded-lg animate-pulse" />
                                <div className="h-10 w-full bg-[#16213a] rounded-lg animate-pulse mt-4" />
                                <p className="text-center text-sm text-[#b0c3e6]">Loading secure sign-in…</p>
                            </div>
                        </ClerkLoading>
                        <ClerkLoaded>
                            <SignIn
                                appearance={{
                                    elements: {
                                        rootBox: 'w-full',
                                        card: 'bg-[#0b1326] border border-[#2b3a57] shadow-xl rounded-xl p-0 overflow-hidden',
                                        headerTitle: 'hidden', // We have our own header
                                        headerSubtitle: 'hidden',
                                        formFieldLabel: 'text-[#adc6ff] font-medium tracking-wide text-sm',
                                        formFieldInput: 'bg-[#131b2e] border-[#2b3a57] text-[#ecf3ff] placeholder:text-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all',
                                        formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-blue-500/20 transition-all',
                                        footerActionLink: 'text-blue-400 hover:text-blue-300 font-medium tracking-wide',
                                        identityPreviewText: 'text-[#adc6ff]',
                                        identityPreviewEditButton: 'text-blue-400 hover:text-blue-300',
                                        socialButtonsBlockButton: 'bg-[#131b2e] border-[#2b3a57] text-[#d2e0fb] hover:bg-[#1a2743] hover:text-[#f2f7ff] hover:border-[#3d4f73] rounded-lg transition-all',
                                        socialButtonsBlockButtonText: 'font-medium tracking-wide',
                                        dividerLine: 'bg-[#1a2743]',
                                        dividerText: 'text-[#a9bcde] uppercase text-xs tracking-wider bg-[#0b1326] px-2',
                                        formFieldInputShowPasswordButton: 'text-[#9fb2d6] hover:text-[#d0dffd]',
                                        otpCodeFieldInput: 'bg-[#131b2e] border-[#2b3a57] text-[#ecf3ff] text-center font-mono font-bold text-lg focus:ring-blue-500',
                                        footer: 'bg-[#0b1326] p-6 border-t border-[#2b3a57]'
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
                                path="/sign-in"
                                signUpUrl="/sign-up"
                                forceRedirectUrl={redirectUrl}
                            />
                        </ClerkLoaded>
                    </div>

                    {/* Additional Links */}
                    <div className="text-center pt-6">
                        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#9fb2d6] hover:text-[#d3e1fc] transition-colors group">
                            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to home
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SignInPage;
