/**
 * FeatureOverviewPanel.tsx - What Can You Do? Panel
 * 
 * Helps users discover all available capabilities in BeamLab.
 * Shows analysis types, design codes, load generators, and export options.
 */

import React, { useState } from 'react';
import {
    BarChart3,
    Ruler,
    Wind,
    Zap,
    FileDown,
    Building2,
    Train,
    ChevronRight,
    Calculator,
    Target,
    Layers,
    Crown,
    ExternalLink,
    Sparkles
} from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

interface FeatureOverviewPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FeatureItem {
    icon: React.ReactNode;
    label: string;
    description: string;
    action?: string;
    isPro?: boolean;
}

interface FeatureSection {
    title: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    items: FeatureItem[];
}

export const FeatureOverviewPanel: React.FC<FeatureOverviewPanelProps> = ({ isOpen, onClose }) => {
    const openModal = useUIStore((s) => s.openModal);
    const [activeSection, setActiveSection] = useState<string | null>('analysis');

    const sections: FeatureSection[] = [
        {
            title: 'Analysis Capabilities',
            icon: <BarChart3 className="w-5 h-5" />,
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            borderColor: 'border-green-500/30',
            items: [
                { icon: <BarChart3 className="w-4 h-4" />, label: 'Static Analysis', description: 'Linear static frame analysis with force diagrams' },
                { icon: <Calculator className="w-4 h-4" />, label: 'Modal Analysis', description: 'Eigenvalue analysis for natural frequencies', isPro: true },
                { icon: <Target className="w-4 h-4" />, label: 'Buckling Analysis', description: 'Critical load factor determination', isPro: true },
                { icon: <Layers className="w-4 h-4" />, label: 'P-Delta Analysis', description: 'Second-order geometric nonlinearity', isPro: true },
                { icon: <Zap className="w-4 h-4" />, label: 'Time History', description: 'Dynamic transient analysis', isPro: true },
                { icon: <BarChart3 className="w-4 h-4" />, label: 'Response Spectrum', description: 'Earthquake response analysis', isPro: true }
            ]
        },
        {
            title: 'Design Codes',
            icon: <Ruler className="w-5 h-5" />,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30',
            items: [
                { icon: <Ruler className="w-4 h-4" />, label: 'IS 456:2000', description: 'Indian concrete design code' },
                { icon: <Ruler className="w-4 h-4" />, label: 'IS 800:2007', description: 'Indian steel design code' },
                { icon: <Ruler className="w-4 h-4" />, label: 'AISC 360-22', description: 'American steel design specification' },
                { icon: <Ruler className="w-4 h-4" />, label: 'Eurocode 2/3', description: 'European concrete & steel codes' },
                { icon: <Ruler className="w-4 h-4" />, label: 'ACI 318-19', description: 'American concrete code' }
            ]
        },
        {
            title: 'Load Generation',
            icon: <Wind className="w-5 h-5" />,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            borderColor: 'border-cyan-500/30',
            items: [
                { icon: <Wind className="w-4 h-4" />, label: 'IS 875 Wind', description: 'Indian wind load as per Part 3', action: 'windLoadDialog' },
                { icon: <Zap className="w-4 h-4" />, label: 'IS 1893 Seismic', description: 'Indian earthquake load', action: 'seismicLoadDialog' },
                { icon: <Wind className="w-4 h-4" />, label: 'ASCE 7 Wind', description: 'American wind load (ASCE 7-22)', action: 'asce7WindDialog' },
                { icon: <Zap className="w-4 h-4" />, label: 'ASCE 7 Seismic', description: 'American seismic load (ELF)', action: 'asce7SeismicDialog' },
                { icon: <Train className="w-4 h-4" />, label: 'Moving Loads', description: 'IRC 6 / AASHTO vehicle loads', action: 'movingLoadDialog' },
                { icon: <Building2 className="w-4 h-4" />, label: 'Railway Bridge', description: 'IRS/MBG bridge loads', action: 'railwayBridge', isPro: true }
            ]
        },
        {
            title: 'Export Options',
            icon: <FileDown className="w-5 h-5" />,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            borderColor: 'border-purple-500/30',
            items: [
                { icon: <FileDown className="w-4 h-4" />, label: 'PDF Report', description: 'Professional calculation report' },
                { icon: <FileDown className="w-4 h-4" />, label: 'DXF Export', description: 'AutoCAD compatible geometry' },
                { icon: <FileDown className="w-4 h-4" />, label: 'IFC Export', description: 'BIM interoperability format', isPro: true },
                { icon: <FileDown className="w-4 h-4" />, label: 'JSON Export', description: 'Portable data format' }
            ]
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden p-0">
                {/* Header */}
                <DialogHeader className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                            <Sparkles className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-white">What Can You Do?</DialogTitle>
                            <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">Explore all BeamLab capabilities</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Keyboard Shortcut Hint */}
                <div className="px-6 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/50">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        💡 <span className="font-medium">Pro tip:</span> Press{' '}
                        <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300">⌘K</kbd>{' '}
                        anytime to quickly search and access any feature
                    </p>
                </div>

                {/* Content */}
                <div className="flex h-[calc(85vh-180px)]">
                    {/* Section Tabs */}
                    <div className="w-56 border-r border-zinc-200 dark:border-zinc-800 p-3 space-y-1">
                        {sections.map((section) => (
                            <button
                                key={section.title}
                                onClick={() => setActiveSection(
                                    activeSection === section.title.toLowerCase().replace(' ', '-')
                                        ? null
                                        : section.title.toLowerCase().replace(' ', '-')
                                )}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                                    ${activeSection === section.title.toLowerCase().replace(' ', '-')
                                        ? `${section.bgColor} ${section.color} border ${section.borderColor}`
                                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
                                    }
                                `}
                            >
                                {section.icon}
                                <span className="text-sm font-medium">{section.title}</span>
                            </button>
                        ))}
                    </div>

                    {/* Feature Items */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {sections.map((section) => (
                            <div
                                key={section.title}
                                className={activeSection === section.title.toLowerCase().replace(' ', '-') ? 'block' : 'hidden'}
                            >
                                <h3 className={`text-lg font-semibold ${section.color} mb-4 flex items-center gap-2`}>
                                    {section.icon}
                                    {section.title}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {section.items.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (item.action) {
                                                    openModal(item.action as any);
                                                    onClose();
                                                }
                                            }}
                                            className={`
                                                flex items-start gap-3 p-4 rounded-xl border transition-all text-left group
                                                ${item.action
                                                    ? `${section.bgColor} ${section.borderColor} hover:brightness-110 cursor-pointer`
                                                    : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50'
                                                }
                                            `}
                                        >
                                            <div className={`p-2 rounded-lg ${section.bgColor}`}>
                                                <span className={section.color}>{item.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-zinc-900 dark:text-white">{item.label}</span>
                                                    {item.isPro && (
                                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                                                            <Crown className="w-2.5 h-2.5" />
                                                            PRO
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.description}</p>
                                            </div>
                                            {item.action && (
                                                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {!activeSection && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Sparkles className="w-16 h-16 text-zinc-400 dark:text-zinc-500 mb-4" />
                                <h3 className="text-lg font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                                    Select a Category
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                                    Choose a category from the left to explore available features
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-500" />
                            PRO features require upgrade
                        </span>
                    </div>
                    <Button onClick={onClose}>
                        Got it!
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FeatureOverviewPanel;
