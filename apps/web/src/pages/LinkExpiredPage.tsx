/**
 * LinkExpiredPage - Invalid/Expired Token Error State
 * 
 * Shown when a verification or reset link has expired.
 * Per Figma §4.6 Auth Error States
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Cpu } from 'lucide-react';
import { Button } from '../components/ui/button';

export const LinkExpiredPage = () => {
    useEffect(() => {
        document.title = 'Link Expired | BeamLab';
    }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center space-y-6">
                {/* Logo */}
                <Link to="/" className="inline-flex items-center gap-3 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Cpu className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">BeamLab</span>
                </Link>

                {/* Card */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl space-y-6">
                    {/* Warning Icon */}
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-8 h-8 text-amber-400" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Link Expired
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400">
                            This verification link has expired. Please request a new one.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <Link to="/verify-email">
                            <Button variant="premium" className="w-full">
                                Resend Verification Email
                            </Button>
                        </Link>
                        <Link to="/sign-in">
                            <Button variant="outline" className="w-full">
                                ← Back to Sign In
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LinkExpiredPage;
