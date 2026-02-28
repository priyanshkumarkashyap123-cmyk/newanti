import React, { useState } from 'react';
import { RCDesignPanel } from '../components/design/RCDesignPanel';
import { FoundationDesignPanel } from '../components/design/FoundationDesignPanel';

export const DetailingDesignPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'rc' | 'foundation'>('rc');

    return (
        <div className="min-h-screen bg-black text-white p-4">
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
                Structural Detailing Center
            </h1>

            <div className="flex space-x-4 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-1">
                <button
                    onClick={() => setActiveTab('rc')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'rc'
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-emerald-400 border-t border-x border-zinc-300 dark:border-zinc-700'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300'
                        }`}
                >
                    RC Members (IS 456)
                </button>
                <button
                    onClick={() => setActiveTab('foundation')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'foundation'
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-blue-400 border-t border-x border-zinc-300 dark:border-zinc-700'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300'
                        }`}
                >
                    Foundation Design
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 min-h-[600px]">
                {activeTab === 'rc' && <RCDesignPanel />}
                {activeTab === 'foundation' && <FoundationDesignPanel />}
            </div>
        </div>
    );
};

export default DetailingDesignPage;
