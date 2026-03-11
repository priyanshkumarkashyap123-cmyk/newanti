/**
 * HelpPage.tsx - Help & Tutorials
 * Dark themed video tutorials grid, FAQ section, and support CTA
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Search, PlayCircle, MessageCircle, Mail,
    ChevronDown, ChevronUp, ExternalLink, Plus,
    Zap, BookOpen, ArrowLeft
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Logo } from '../components/branding';
import { SEO } from '../components/SEO';

// ============================================
// TYPES & DATA
// ============================================

interface VideoTutorial {
    id: string;
    title: string;
    description: string;
    duration: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
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
    },
    {
        id: '2',
        title: 'Applying Advanced Loads',
        description: 'Master point loads, distributed loads, and create complex load combinations for your analysis.',
        duration: '8:45',
        level: 'Intermediate',
    },
    {
        id: '3',
        title: 'Analyzing & Interpreting Results',
        description: 'A deep dive into shear forces, bending moments, and deflection diagrams to optimize your design.',
        duration: '12:10',
        level: 'Intermediate',
    },
    {
        id: '4',
        title: 'AI-Assisted Design Optimization',
        description: 'Use the AI assistant to get section recommendations and optimize your structural design.',
        duration: '10:30',
        level: 'Advanced',
    },
    {
        id: '5',
        title: 'Multi-Story Frame Analysis',
        description: 'Complete walkthrough of modeling and analyzing a 3D multi-story building frame.',
        duration: '18:45',
        level: 'Advanced',
    },
    {
        id: '6',
        title: 'Generating Professional Reports',
        description: 'Create comprehensive PDF reports with custom branding for your clients.',
        duration: '7:20',
        level: 'Beginner',
    },
];

const faqs: FAQ[] = [
    {
        id: '1',
        question: 'How do I export my analysis report to PDF?',
        answer: 'Navigate to the Reports tab in the main navigation. Click on "Generate Report" and select "Export as PDF". You can customize which sections are included in the final document.',
    },
    {
        id: '2',
        question: 'What design codes are currently supported?',
        answer: 'BeamLab supports AISC 360-16, Eurocode 3, IS 800, and AS 4100 for steel. Concrete codes include ACI 318-19, Eurocode 2, and IS 456. We regularly update based on user feedback.',
    },
    {
        id: '3',
        question: 'How do I fix "Geometric Instability" errors?',
        answer: 'This error occurs when your structure has insufficient supports. Check that: 1) All supports are properly constrained, 2) Member releases don\'t create mechanisms, 3) The structure is properly connected.',
    },
    {
        id: '4',
        question: 'Can I collaborate with other team members?',
        answer: 'Yes! Pro and Enterprise plans support real-time collaboration. Invite team members to your project and work together with automatic sync.',
    },
];

// ============================================
// COMPONENTS
// ============================================

const VideoCard = ({ tutorial, index }: { tutorial: VideoTutorial; index: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="group bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 transition-all duration-300 cursor-pointer flex flex-col h-full hover-lift"
    >
        <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-blue-500/30" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <PlayCircle className="w-8 h-8 text-blue-600 ml-0.5" />
                </div>
            </div>
            <span className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-md">
                {tutorial.duration}
            </span>
        </div>
        <div className="p-5 flex flex-col flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-400 transition-colors">
                {tutorial.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                {tutorial.description}
            </p>
            <div className="mt-auto flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <span className={`w-2 h-2 rounded-full ${tutorial.level === 'Beginner' ? 'bg-green-500' :
                    tutorial.level === 'Intermediate' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                {tutorial.level}
            </div>
        </div>
    </motion.div>
);

const FAQItem = ({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) => (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900 overflow-hidden">
        <Button
            variant="ghost"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 h-auto rounded-none"
        >
            <span className="font-bold text-slate-900 dark:text-white pr-4">{faq.question}</span>
            {isOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            ) : (
                <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            )}
        </Button>
        {isOpen && (
            <div className="p-5 pt-0 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                <p className="mt-4">{faq.answer}</p>
            </div>
        )}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const HelpPage = () => {
    useEffect(() => { document.title = 'Help - BeamLab'; }, []);

    const [searchQuery, setSearchQuery] = useState('');
    const [openFAQ, setOpenFAQ] = useState<string | null>('1');

    const query = searchQuery.toLowerCase();
    const filteredTutorials = tutorials.filter(t =>
        !query || t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query) || t.level.toLowerCase().includes(query)
    );
    const filteredFaqs = faqs.filter(f =>
        !query || f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query)
    );

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col font-sans selection:bg-blue-500/30">
            <SEO
                title="Help & Tutorials"
                description="BeamLab help center with video tutorials, FAQs, and support for structural engineering design tools."
                path="/help"
            />
            {/* Header - Dark Theme */}
            <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Logo size="sm" variant="full" href="/" />
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/stream" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">Dashboard</Link>
                            <Link to="/app" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">Projects</Link>
                            <Link to="/help" className="text-slate-900 dark:text-white font-semibold text-sm">Help</Link>
                            <Link to="/app" className="flex items-center gap-2 rounded-full h-9 px-5 bg-white text-slate-950 text-sm font-bold hover:bg-slate-100 transition-colors">
                                <Plus className="w-4 h-4" />
                                New Project
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center w-full px-6 py-12">
                <div className="w-full max-w-6xl flex flex-col gap-12">
                    {/* Page Heading & Search */}
                    <section className="text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col gap-4 max-w-2xl mx-auto mb-8"
                        >
                            <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">
                                Documentation
                            </span>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Help & Tutorials
                            </h1>
                            <p className="text-lg text-slate-600 dark:text-slate-400">
                                Master structural analysis with our comprehensive video guides and expert support.
                            </p>
                        </motion.div>

                        {/* Search Bar */}
                        <div className="relative w-full max-w-2xl mx-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 dark:text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for topics, commands, or errors..."
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 pl-12 pr-4 py-4 text-base text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600 dark:placeholder:text-slate-400 transition-all"
                            />
                            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-1 font-sans text-xs text-slate-600 dark:text-slate-400">
                                ⌘K
                            </kbd>
                        </div>
                    </section>

                    {/* Video Tutorials Grid */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10">
                                    <PlayCircle className="w-6 h-6 text-blue-400" />
                                </div>
                                Video Tutorials
                            </h2>
                            <Button variant="link" className="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 group">
                                View all videos
                                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTutorials.length > 0 ? filteredTutorials.map((tutorial, index) => (
                                <VideoCard key={tutorial.id} tutorial={tutorial} index={index} />
                            )) : (
                                <p className="col-span-full text-center text-slate-500 dark:text-slate-400 py-8">No tutorials match your search.</p>
                            )}
                        </div>
                    </section>

                    {/* FAQ Section */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
                        <div className="md:col-span-1">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                                Frequently Asked Questions
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                                Can't find the answer you're looking for? Browse our full documentation or reach out to support.
                            </p>
                            <a
                                href="/help"
                                className="inline-flex items-center text-blue-400 font-bold text-sm hover:text-blue-300 transition-colors"
                            >
                                Go to Documentation Center
                                <ExternalLink className="ml-2 w-4 h-4" />
                            </a>
                        </div>
                        <div className="md:col-span-2 flex flex-col gap-4">
                            {filteredFaqs.length > 0 ? filteredFaqs.map((faq) => (
                                <FAQItem
                                    key={faq.id}
                                    faq={faq}
                                    isOpen={openFAQ === faq.id}
                                    onToggle={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)}
                                />
                            )) : (
                                <p className="text-center text-slate-500 dark:text-slate-400 py-8">No FAQs match your search.</p>
                            )}
                        </div>
                    </section>

                    {/* Support CTA */}
                    <section className="mt-4 mb-8">
                        <div className="bg-gradient-to-r from-slate-50 dark:from-slate-900 to-slate-100 dark:to-slate-800 rounded-2xl p-8 md:p-12 relative overflow-hidden border border-slate-200 dark:border-slate-800">
                            {/* Decorative background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                                <div className="max-w-xl">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Still need help?</h3>
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Our dedicated structural engineering support team is ready to assist you with complex modeling questions or technical issues.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                                    <Button variant="premium" className="py-3 px-6 w-full sm:w-auto">
                                        <MessageCircle className="w-5 h-5" />
                                        Chat with Support
                                    </Button>
                                    <Button variant="outline" className="py-3 px-6 w-full sm:w-auto hover:bg-slate-300 dark:hover:bg-slate-600" onClick={() => window.location.href = 'mailto:decodedoffice@gmail.com'}>
                                        <Mail className="w-5 h-5" />
                                        Email Us
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Footer - Dark Theme */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <p>© {new Date().getFullYear()} BeamLab. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</Link>
                        <Link to="/help" className="hover:text-slate-900 dark:hover:text-white transition-colors">Status</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default HelpPage;
