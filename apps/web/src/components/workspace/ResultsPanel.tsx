/**
 * ResultsPanel - Bottom panel for analysis results
 * Tabbed interface for Reactions, Force Diagrams, and Reports
 */

import { FC, ReactNode, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';

export interface ResultsTab {
    id: string;
    label: string;
    content: ReactNode;
    badge?: string | number;
    icon?: ReactNode;
}

export interface ResultsPanelProps {
    tabs: ResultsTab[];
    defaultTab?: string;
    isLoading?: boolean;
}

export const ResultsPanel: FC<ResultsPanelProps> = ({ tabs, defaultTab, isLoading }) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    const activeTabContent = tabs.find(t => t.id === activeTab)?.content;

    if (tabs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <BarChart3 className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium tracking-wide tracking-wide text-[#869ab8]">No results yet</p>
                <p className="text-xs text-[#424754] mt-1">Run analysis (F5) to see results here</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Tab Headers */}
            <div className="flex items-center px-2 bg-[#131b2e] border-b border-[#1a2333] h-9 shrink-0">
                {tabs.map((tab) => (
                    <button type="button"
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            px-4 h-full text-xs font-semibold transition-colors relative cursor-pointer
                            ${activeTab === tab.id
                                ? 'text-[#dae2fd] bg-slate-200/30 dark:bg-slate-700/30 border-b-2 border-blue-500'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent'
                            }
                        `}
                    >
                        <span className="flex items-center gap-2">
                            {tab.icon}
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className="bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {tab.badge}
                                </span>
                            )}
                        </span>
                    </button>
                ))}
                <div className="flex-1"></div>
                <button type="button" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[#869ab8]" title="Maximize panel" aria-label="Maximize results panel">
                    <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto bg-white/50 dark:bg-slate-900/50">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="ml-2 text-sm text-[#869ab8]">Computing results...</span>
                    </div>
                ) : activeTabContent ? (
                    activeTabContent
                ) : (
                    <div className="flex items-center justify-center h-full py-12">
                        <p className="text-sm text-[#424754]">Select a tab to view results</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsPanel;
