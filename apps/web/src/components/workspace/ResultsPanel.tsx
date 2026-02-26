/**
 * ResultsPanel - Bottom panel for analysis results
 * Tabbed interface for Reactions, Force Diagrams, and Reports
 */

import { FC, ReactNode, useState } from 'react';

export interface ResultsTab {
    id: string;
    label: string;
    content: ReactNode;
    badge?: string | number;
}

export interface ResultsPanelProps {
    tabs: ResultsTab[];
    defaultTab?: string;
}

export const ResultsPanel: FC<ResultsPanelProps> = ({ tabs, defaultTab }) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    const activeTabContent = tabs.find(t => t.id === activeTab)?.content;

    return (
        <div className="flex flex-col h-full">
            {/* Tab Headers */}
            <div className="flex items-center px-2 bg-zinc-800 border-b border-zinc-700 h-9 shrink-0">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            px-4 h-full text-xs font-semibold transition-colors relative
                            ${activeTab === tab.id
                                ? 'text-white bg-zinc-700/30 border-b-2 border-blue-500'
                                : 'text-zinc-400 hover:text-zinc-200 border-b-2 border-transparent'
                            }
                        `}
                    >
                        <span className="flex items-center gap-2">
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className="bg-zinc-600 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">
                                    {tab.badge}
                                </span>
                            )}
                        </span>
                    </button>
                ))}
                <div className="flex-1"></div>
                <button className="p-1 hover:bg-zinc-700 rounded text-zinc-400">
                    <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto bg-zinc-900/50">
                {activeTabContent}
            </div>
        </div>
    );
};

export default ResultsPanel;
