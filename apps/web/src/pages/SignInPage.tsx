/**
 * SignInPage - Clerk Sign In Page
 * 
 * Uses Clerk for authentication with Premium Navy Theme
 */

import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { Cpu, CheckCircle } from 'lucide-react';

export const SignInPage = () => {
    return (
        <div className="min-h-screen bg-slate-950 flex font-sans selection:bg-blue-500/30">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 border-r border-slate-800">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-slate-900 to-slate-950" />
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
                <div className="relative z-10 flex flex-col justify-between p-16 text-slate-50 w-full">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group w-fit">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-blue-500/25 transition-all">
                            <Cpu className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">BeamLab</span>
                            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full tracking-wide">ULTIMATE</span>
                        </div>
                    </Link>

                    {/* Tagline */}
                    <div className="space-y-8">
                        <h1 className="text-5xl font-bold leading-tight">
                            Build the future,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                Engineer with confidence
                            </span>
                        </h1>
                        <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
                            Access the most powerful browser-based structural analysis platform.
                            Designed for modern engineering teams.
                        </p>

                        {/* Features reminder */}
                        <div className="space-y-4 pt-4">
                            {[
                                { label: 'Real-time 6-DOF analysis solver' },
                                { label: 'AI-assisted structural modeling' },
                                { label: 'Automated professional reporting' },
                                { label: 'Seamless cloud collaboration' }
                            ].map((f, i) => (
                                <div key={i} className="flex items-center gap-3 group">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                        <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                                    </div>
                                    <span className="text-slate-300 font-medium">{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-8 py-8 border-t border-slate-800/50">
                        <div>
                            <div className="text-3xl font-bold text-white">10K+</div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Users</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-white">99.9%</div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Uptime</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-white">24/7</div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Support</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Sign In Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-950">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">BeamLab Ultimate</span>
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
                        <p className="text-slate-400">
                            Enter your credentials to access your workspace
                        </p>
                    </div>

                    {/* Clerk Sign In */}
                    <div className="clerk-signin-container">
                        <SignIn
                            appearance={{
                                elements: {
                                    rootBox: 'w-full',
                                    card: 'bg-slate-900 border border-slate-800 shadow-xl rounded-xl p-0 overflow-hidden',
                                    headerTitle: 'hidden', // We have our own header
                                    headerSubtitle: 'hidden',
                                    formFieldLabel: 'text-slate-300 font-medium text-sm',
                                    formFieldInput: 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all',
                                    formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-blue-500/20 transition-all',
                                    footerActionLink: 'text-blue-400 hover:text-blue-300 font-medium',
                                    identityPreviewText: 'text-slate-300',
                                    identityPreviewEditButton: 'text-blue-400 hover:text-blue-300',
                                    socialButtonsBlockButton: 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600 rounded-lg transition-all',
                                    socialButtonsBlockButtonText: 'font-medium',
                                    dividerLine: 'bg-slate-800',
                                    dividerText: 'text-slate-500 uppercase text-xs tracking-wider bg-slate-900 px-2',
                                    formFieldInputShowPasswordButton: 'text-slate-400 hover:text-slate-300',
                                    otpCodeFieldInput: 'bg-slate-800 border-slate-700 text-white text-center font-mono font-bold text-lg focus:ring-blue-500',
                                    footer: 'bg-slate-900/50 p-6 border-t border-slate-800'
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
                    </div>

                    {/* Additional Links */}
                    <div className="text-center pt-6">
                        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors group">
                            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
