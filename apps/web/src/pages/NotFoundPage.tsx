/**
 * NotFoundPage — Animated 404 error page
 * 
 * Industry standard: Show a helpful, engaging 404 page with
 * smooth animations and clear navigation options.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, LayoutDashboard, Play, Search, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export function NotFoundPage() {
    useEffect(() => {
        document.title = 'Page Not Found - BeamLab';
    }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-6 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <motion.div
                    className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/[0.04] rounded-full blur-3xl"
                    animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/[0.04] rounded-full blur-3xl"
                    animate={{ scale: [1.2, 1, 1.2], x: [0, -20, 0], y: [0, 30, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>

            <div className="text-center max-w-lg relative z-10">
                {/* Animated 404 number */}
                <motion.div
                    custom={0}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className="relative mb-6"
                >
                    <h1
                        className="text-[10rem] sm:text-[12rem] font-black leading-none bg-gradient-to-b from-blue-400 via-violet-400 to-cyan-400/60 bg-clip-text text-transparent select-none"
                    >
                        404
                    </h1>
                    {/* Shadow glow */}
                    <div className="absolute inset-0 text-[10rem] sm:text-[12rem] font-black leading-none text-blue-500/5 blur-2xl select-none pointer-events-none" aria-hidden="true">
                        404
                    </div>
                </motion.div>

                {/* Message */}
                <motion.h2
                    custom={1}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className="text-xl sm:text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-3"
                >
                    Page Not Found
                </motion.h2>
                <motion.p
                    custom={2}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed text-sm sm:text-base"
                >
                    The page you're looking for doesn't exist or has been moved.
                    Check the URL or navigate back using one of the links below.
                </motion.p>

                {/* Action buttons */}
                <motion.div
                    custom={3}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col sm:flex-row gap-3 justify-center"
                >
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
                            to="/pricing"
                            className="inline-flex items-center justify-center gap-2 no-underline"
                        >
                            <Play className="w-5 h-5" />
                            View Pricing
                        </Link>
                    </Button>
                </motion.div>

                {/* Secondary actions */}
                <motion.div
                    custom={4}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm"
                >
                    <button type="button"
                        onClick={() => window.history.back()}
                        className="text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go back
                    </button>
                    <span className="hidden sm:block text-slate-700 dark:text-slate-700">•</span>
                    <Link to="/help" className="text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5">
                        <Search className="w-4 h-4" />
                        Search help docs
                    </Link>
                    <span className="hidden sm:block text-slate-700 dark:text-slate-700">•</span>
                    <Link to="/contact" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Contact support
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}

export default NotFoundPage;
