/**
 * AccountLockedPage - Account Locked Error State
 * 
 * Shown when a user's account is temporarily locked
 * due to too many failed login attempts.
 * Per Figma §4.6 Auth Error States
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Cpu } from 'lucide-react';
import { Button } from '../components/ui/button';

export const AccountLockedPage = () => {
    const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes default

    useEffect(() => {
        document.title = 'Account Locked | BeamLab';
    }, []);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center space-y-6">
                <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                    <Link to="/" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Home</Link>
                    <span>•</span>
                    <Link to="/help" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Help Center</Link>
                    <span>•</span>
                    <Link to="/sign-in" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Sign In</Link>
                </div>
                {/* Logo */}
                <Link to="/" className="inline-flex items-center gap-3 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Cpu className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">BeamLab</span>
                </Link>

                {/* Card */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl space-y-6">
                    {/* Lock Icon */}
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                        <Lock className="w-8 h-8 text-amber-400" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Account Locked
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400">
                            Your account has been temporarily locked due to too many failed login attempts.
                        </p>
                    </div>

                    {/* Countdown Timer */}
                    {timeLeft > 0 && (
                        <div className="py-4 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Try again in:</p>
                            <p className="text-3xl font-mono font-bold text-slate-900 dark:text-white">
                                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <Link to="/forgot-password">
                            <Button variant="premium" className="w-full">
                                Reset Password
                            </Button>
                        </Link>
                        <a href="mailto:support@beamlabultimate.tech">
                            <Button variant="outline" className="w-full">
                                Contact Support
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Back link */}
                <Link
                    to="/sign-in"
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-700 dark:text-slate-300 transition-colors group"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Sign In
                </Link>
            </div>
        </div>
    );
};

export default AccountLockedPage;
