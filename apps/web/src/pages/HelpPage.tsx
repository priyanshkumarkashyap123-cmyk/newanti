/**
 * HelpPage.tsx - Help & Tutorials
 * Video tutorials grid, FAQ section, and support CTA
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, PlayCircle, HelpCircle, MessageCircle, Mail,
    ChevronDown, ChevronUp, ExternalLink, Plus, Shield,
    Zap, BookOpen
} from 'lucide-react';

// ============================================
// TYPES & DATA
// ============================================

interface VideoTutorial {
    id: string;
    title: string;
    description: string;
    duration: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    thumbnail: string;
}

interface FAQ {
    id: string;
    question: string;
    answer: string;
}

const tutorials: VideoTutorial[] = [
    {
        id: '1',
        title: 'Getting Started with Beams',
        description: 'Learn how to define geometry, set up support conditions, and navigate the workspace in minutes.',
        duration: '5:02',
        level: 'Beginner',
        thumbnail: '/api/placeholder/400/225',
    },
    {
        id: '2',
        title: 'Applying Advanced Loads',
        description: 'Master point loads, distributed loads, and create complex load combinations for your analysis.',
        duration: '8:45',
        level: 'Intermediate',
        thumbnail: '/api/placeholder/400/225',
    },
    {
        id: '3',
        title: 'Analyzing & Interpreting Results',
        description: 'A deep dive into shear forces, bending moments, and deflection diagrams to optimize your design.',
        duration: '12:10',
        level: 'Intermediate',
        thumbnail: '/api/placeholder/400/225',
    },
];

const faqs: FAQ[] = [
    {
        id: '1',
        question: 'How do I export my analysis report to PDF?',
        answer: 'To export your report, navigate to the Reports tab in the main navigation. Click on the "Generate Report" button in the top right corner. From the dropdown menu, select "Export as PDF". You can customize which sections (Geometry, Loads, Results) are included in the final document.',
    },
    {
        id: '2',
        question: 'What design codes are currently supported?',
        answer: 'BeamLab Ultimate supports AISC 360-16, Eurocode 3, IS 800, and AS 4100 for steel design. Concrete design codes include ACI 318-19, Eurocode 2, and IS 456. We regularly update our code library based on user feedback.',
    },
    {
        id: '3',
        question: 'How do I fix "Geometric Instability" errors?',
        answer: 'This error typically occurs when your structure has insufficient supports or releases that create a mechanism. Check that: 1) All supports are properly constrained, 2) Member releases don\'t create hinges that allow rigid-body motion, 3) The structure is properly connected without floating nodes.',
    },
    {
        id: '4',
        question: 'Can I collaborate with other team members?',
        answer: 'Yes! Pro and Enterprise plans support real-time collaboration. You can invite team members to your project and work together on the same model. Changes sync automatically and you can see who\'s working on what in real-time.',
    },
];

// ============================================
// COMPONENTS
// ============================================

const VideoCard = ({ tutorial }: { tutorial: VideoTutorial }) => (
    <div className="group bg-white dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:shadow-lg hover:border-blue-500/30 dark:hover:border-blue-500/50 transition-all duration-300 cursor-pointer flex flex-col h-full">
        <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-blue-600/40" />
            </div>
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
                    <PlayCircle className="w-8 h-8 text-blue-600 ml-0.5" />
                </div>
            </div>
            <span className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-md">
                {tutorial.duration}
            </span>
        </div>
        <div className="p-5 flex flex-col flex-1">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                {tutorial.title}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">
                {tutorial.description}
            </p>
            <div className="mt-auto flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                <span className={`w-2 h-2 rounded-full ${tutorial.level === 'Beginner' ? 'bg-green-500' :
                        tutorial.level === 'Intermediate' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                {tutorial.level}
            </div>
        </div>
    </div>
);

const FAQItem = ({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) => (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
        >
            <span className="font-bold text-zinc-900 dark:text-white pr-4">{faq.question}</span>
            {isOpen ? (
                <ChevronUp className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            ) : (
                <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            )}
        </button>
        {isOpen && (
            <div className="p-5 pt-0 border-t border-zinc-100 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">
                <p className="mt-4">{faq.answer}</p>
            </div>
        )}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const HelpPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [openFAQ, setOpenFAQ] = useState<string | null>('1');

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
                <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">BeamLab Ultimate</h2>
                    </Link>
                    <div className="hidden md:flex items-center gap-8">
                        <nav className="flex items-center gap-6">
                            <Link to="/dashboard" className="text-zinc-600 dark:text-zinc-300 hover:text-blue-600 text-sm font-medium transition-colors">Dashboard</Link>
                            <Link to="/app" className="text-zinc-600 dark:text-zinc-300 hover:text-blue-600 text-sm font-medium transition-colors">Projects</Link>
                            <Link to="/reports" className="text-zinc-600 dark:text-zinc-300 hover:text-blue-600 text-sm font-medium transition-colors">Reports</Link>
                            <Link to="/help" className="text-blue-600 font-semibold text-sm transition-colors">Help</Link>
                        </nav>
                        <Link to="/app" className="flex items-center gap-2 rounded-lg h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
                            <Plus className="w-4 h-4" />
                            New Project
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center w-full px-6 py-10">
                <div className="w-full max-w-5xl flex flex-col gap-10">
                    {/* Page Heading & Search */}
                    <section className="flex flex-col gap-8 text-center md:text-left">
                        <div className="flex flex-col gap-3 max-w-2xl">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                                Help & Tutorials
                            </h1>
                            <p className="text-lg text-zinc-500 dark:text-zinc-400">
                                Master structural analysis with our comprehensive video guides, documentation, and expert support.
                            </p>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full max-w-2xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for topics, commands, or errors (e.g. 'Moment Distribution')"
                                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-12 pr-4 py-4 text-base text-zinc-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder:text-zinc-400 transition-all"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <kbd className="hidden sm:inline-flex items-center rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-700 px-2 py-1 font-sans text-xs text-zinc-400">
                                    ⌘K
                                </kbd>
                            </div>
                        </div>
                    </section>

                    {/* Video Tutorials Grid */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <PlayCircle className="w-6 h-6 text-blue-600" />
                                Video Tutorials
                            </h2>
                            <button className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 group">
                                View all videos
                                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tutorials.map((tutorial) => (
                                <VideoCard key={tutorial.id} tutorial={tutorial} />
                            ))}
                        </div>
                    </section>

                    {/* FAQ Section */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
                        <div className="md:col-span-1">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                                Frequently Asked Questions
                            </h2>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                                Can't find the answer you're looking for? Browse our full documentation or reach out to support.
                            </p>
                            <a
                                href="#"
                                className="inline-flex items-center text-blue-600 font-bold text-sm hover:underline"
                            >
                                Go to Documentation Center
                                <ExternalLink className="ml-1 w-4 h-4" />
                            </a>
                        </div>
                        <div className="md:col-span-2 flex flex-col gap-4">
                            {faqs.map((faq) => (
                                <FAQItem
                                    key={faq.id}
                                    faq={faq}
                                    isOpen={openFAQ === faq.id}
                                    onToggle={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Support CTA */}
                    <section className="mt-8 mb-12">
                        <div className="bg-zinc-900 dark:bg-blue-950/30 rounded-2xl p-8 md:p-12 relative overflow-hidden">
                            {/* Decorative background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                                <div className="max-w-xl">
                                    <h3 className="text-2xl font-bold text-white mb-3">Still need help?</h3>
                                    <p className="text-zinc-300">
                                        Our dedicated structural engineering support team is ready to assist you with complex modeling questions or technical issues.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                                    <button className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full sm:w-auto">
                                        <MessageCircle className="w-5 h-5" />
                                        Chat with Support
                                    </button>
                                    <button className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-3 px-6 rounded-lg transition-colors w-full sm:w-auto">
                                        <Mail className="w-5 h-5" />
                                        Email Us
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-8">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <p>© 2024 BeamLab Software. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                        <a href="#" className="hover:text-blue-600 transition-colors">Status</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default HelpPage;
