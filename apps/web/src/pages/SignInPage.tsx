/**
 * SignInPage - Clerk Sign In Page
 * 
 * Uses Clerk for authentication
 */

import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';

export const SignInPage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-zinc-900" />

                {/* Grid Pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                        linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px'
                }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 text-white">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl font-bold">
                            ⬡
                        </div>
                        <div>
                            <span className="text-2xl font-bold">BeamLab</span>
                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">ULTIMATE</span>
                        </div>
                    </div>

                    {/* Tagline */}
                    <div className="space-y-6">
                        <h1 className="text-5xl font-bold leading-tight">
                            Welcome Back<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                Engineer
                            </span>
                        </h1>
                        <p className="text-lg text-zinc-400 max-w-md">
                            Continue your structural analysis journey with BeamLab Ultimate.
                        </p>

                        {/* Features reminder */}
                        <div className="space-y-3 pt-4">
                            {[
                                { icon: '⚡', label: 'Real-time 3D structural analysis' },
                                { icon: '🤖', label: 'AI-powered design assistance' },
                                { icon: '📊', label: 'Professional PDF reports' },
                                { icon: '☁️', label: 'Cloud-synced projects' }
                            ].map((f, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                    <span className="w-5 h-5 flex items-center justify-center text-xs">
                                        {f.icon}
                                    </span>
                                    <span className="text-zinc-300">{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-blue-400">10K+</div>
                            <div className="text-sm text-zinc-500">Engineers</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-purple-400">50K+</div>
                            <div className="text-sm text-zinc-500">Analyses</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-400">99.9%</div>
                            <div className="text-sm text-zinc-500">Uptime</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Sign In Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl font-bold text-white">
                            ⬡
                        </div>
                        <span className="text-xl font-bold text-white">BeamLab</span>
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
                        <p className="text-zinc-400">
                            Access your structural engineering workspace
                        </p>
                    </div>

                    {/* Clerk Sign In */}
                    <div className="clerk-signin-container">
                        <SignIn
                            appearance={{
                                elements: {
                                    rootBox: 'w-full',
                                    card: 'bg-zinc-900/50 border border-zinc-800 shadow-2xl backdrop-blur-sm',
                                    headerTitle: 'text-white',
                                    headerSubtitle: 'text-zinc-400',
                                    formFieldLabel: 'text-zinc-300',
                                    formFieldInput: 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500',
                                    formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500',
                                    footerActionLink: 'text-blue-400 hover:text-blue-300',
                                    identityPreviewText: 'text-white',
                                    identityPreviewEditButton: 'text-blue-400',
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
                            path="/sign-in"
                            signUpUrl="/sign-up"
                            afterSignInUrl="/app"
                        />
                    </div>

                    {/* Additional Links */}
                    <div className="text-center space-y-4">
                        <p className="text-zinc-400">
                            Don't have an account?{' '}
                            <Link to="/sign-up" className="text-blue-400 hover:text-blue-300 font-medium">
                                Sign up for free
                            </Link>
                        </p>
                        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-400 flex items-center justify-center gap-2">
                            ← Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
