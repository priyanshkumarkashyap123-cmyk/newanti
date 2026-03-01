/**
 * NotFoundPage — Proper 404 error page
 * 
 * Industry standard: Show a helpful 404 page instead of silently
 * redirecting to home (which confuses users and hurts SEO).
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, LayoutDashboard, Play } from 'lucide-react';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
    useEffect(() => {
        document.title = 'Page Not Found - BeamLab';
    }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-6">
            <div className="text-center max-w-lg">
                {/* 404 number */}
                <h1
                    className="text-8xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent"
                >
                    404
                </h1>

                {/* Message */}
                <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-3">
                    Page Not Found
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    The page you're looking for doesn't exist or has been moved.
                    Check the URL or navigate back to the dashboard.
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild variant="premium" size="lg">
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center gap-2 no-underline"
                        >
                            <Home className="w-5 h-5" />
                            Go Home
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <Link
                            to="/stream"
                            className="inline-flex items-center justify-center gap-2 no-underline"
                        >
                            <LayoutDashboard className="w-5 h-5" />
                            Dashboard
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <Link
                            to="/demo"
                            className="inline-flex items-center justify-center gap-2 no-underline"
                        >
                            <Play className="w-5 h-5" />
                            Try Demo
                        </Link>
                    </Button>
                </div>

                {/* Help text */}
                <p className="text-slate-500 text-sm mt-8">
                    Need help?{' '}
                    <Link to="/contact" className="text-blue-400 hover:text-blue-300">
                        Contact support
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default NotFoundPage;
