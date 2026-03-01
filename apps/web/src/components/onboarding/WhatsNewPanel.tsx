/**
 * WhatsNewPanel - Changelog / What's New Modal
 * 
 * Shows on first login after an update.
 * Can be re-accessed from Help menu.
 * Per Figma §19.5
 */

import { FC, useState } from 'react';
import { X, Sparkles, Wrench, Bug, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';

interface WhatsNewPanelProps {
    isOpen: boolean;
    onClose: () => void;
    version?: string;
}

interface ChangelogEntry {
    type: 'feature' | 'improvement' | 'bugfix';
    title: string;
    description: string;
    link?: string;
}

const CHANGELOG: {
    version: string;
    date: string;
    features: ChangelogEntry[];
    improvements: ChangelogEntry[];
    bugfixes: ChangelogEntry[];
} = {
    version: 'v2.2',
    date: 'January 2025',
    features: [
        {
            type: 'feature',
            title: 'AI Section Optimizer',
            description: 'Automatically find the lightest sections that pass all design checks. Save up to 15% steel.',
            link: '/docs/ai-optimizer',
        },
        {
            type: 'feature',
            title: 'Pushover Analysis',
            description: 'Full nonlinear static pushover with ASCE 41-17 hinge definitions and performance level tracking.',
            link: '/docs/pushover',
        },
        {
            type: 'feature',
            title: 'IFC 4.3 Support',
            description: 'Import and export IFC 4.3 files for seamless BIM integration with Revit 2024.',
            link: '/docs/ifc',
        },
    ],
    improvements: [
        { type: 'improvement', title: '40% faster analysis for models > 500 members', description: '' },
        { type: 'improvement', title: 'Improved load combination auto-generation', description: '' },
        { type: 'improvement', title: 'Better IS 1893 response spectrum implementation', description: '' },
        { type: 'improvement', title: 'Dark mode refinements', description: '' },
    ],
    bugfixes: [
        { type: 'bugfix', title: 'Fixed incorrect moment sign convention in SFD', description: '' },
        { type: 'bugfix', title: 'Fixed Excel export missing header row', description: '' },
        { type: 'bugfix', title: 'Fixed undo not working after grid generation', description: '' },
    ],
};

const typeIcon = {
    feature: <Sparkles className="w-4 h-4 text-blue-400" />,
    improvement: <Wrench className="w-4 h-4 text-amber-400" />,
    bugfix: <Bug className="w-4 h-4 text-green-400" />,
};

export const WhatsNewPanel: FC<WhatsNewPanelProps> = ({ isOpen, onClose }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem(`whatsNew-${CHANGELOG.version}-dismissed`, 'true');
        }
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={handleClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">What's New in {CHANGELOG.version}</h2>
                                    <p className="text-sm text-slate-500">🎉 {CHANGELOG.date} Update</p>
                                </div>
                                <button onClick={handleClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                                {/* New Features */}
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">New Features</h3>
                                    <div className="space-y-4">
                                        {CHANGELOG.features.map((f) => (
                                            <div key={f.title} className="flex gap-3">
                                                <div className="mt-0.5">{typeIcon.feature}</div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{f.title}</p>
                                                    <p className="text-sm text-slate-500 mt-0.5">{f.description}</p>
                                                    {f.link && (
                                                        <button className="text-xs text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1">
                                                            Try it → <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Improvements */}
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Improvements</h3>
                                    <div className="space-y-2">
                                        {CHANGELOG.improvements.map((item) => (
                                            <div key={item.title} className="flex items-center gap-2 text-sm text-slate-400">
                                                {typeIcon.improvement}
                                                {item.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Bug Fixes */}
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Bug Fixes</h3>
                                    <div className="space-y-2">
                                        {CHANGELOG.bugfixes.map((item) => (
                                            <div key={item.title} className="flex items-center gap-2 text-sm text-slate-400">
                                                {typeIcon.bugfix}
                                                {item.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={dontShowAgain}
                                        onChange={(e) => setDontShowAgain(e.target.checked)}
                                        className="accent-blue-500"
                                    />
                                    Don't show this again
                                </label>
                                <Button variant="outline" size="sm" onClick={handleClose}>
                                    View Full Changelog →
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default WhatsNewPanel;
