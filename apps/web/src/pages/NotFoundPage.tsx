/**
 * NotFoundPage — Proper 404 error page
 * 
 * Industry standard: Show a helpful 404 page instead of silently
 * redirecting to home (which confuses users and hurts SEO).
 */

import { Link } from 'react-router-dom';

export function NotFoundPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-6">
            <div className="text-center max-w-lg">
                {/* 404 number */}
                <h1
                    className="text-8xl font-bold mb-4"
                    style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}
                >
                    404
                </h1>

                {/* Message */}
                <h2 className="text-2xl font-semibold text-slate-200 mb-3">
                    Page Not Found
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    The page you're looking for doesn't exist or has been moved.
                    Check the URL or navigate back to the dashboard.
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors no-underline"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>home</span>
                        Go Home
                    </Link>
                    <Link
                        to="/stream"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors no-underline"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>dashboard</span>
                        Dashboard
                    </Link>
                    <Link
                        to="/demo"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors no-underline"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_arrow</span>
                        Try Demo
                    </Link>
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
