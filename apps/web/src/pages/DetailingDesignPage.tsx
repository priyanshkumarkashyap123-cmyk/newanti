import React, { useState, useEffect } from 'react';
import { RCDesignPanel } from '../components/design/RCDesignPanel';
import { FoundationDesignPanel } from '../components/design/FoundationDesignPanel';

export const DetailingDesignPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'rc' | 'foundation'>('rc');

    useEffect(() => { document.title = 'Detailing Design | BeamLab Ultimate'; }, []);

    return (
        <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white p-4">
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
                Structural Detailing Center
            </h1>

            <div className="flex space-x-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-1">
                <button
                    onClick={() => setActiveTab('rc')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'rc'
                            ? 'bg-slate-100 dark:bg-slate-800 text-emerald-400 border-t border-x border-slate-300 dark:border-slate-700'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                        }`}
                >
                    RC Members (IS 456)
                </button>
                <button
                    onClick={() => setActiveTab('foundation')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'foundation'
                            ? 'bg-slate-100 dark:bg-slate-800 text-blue-400 border-t border-x border-slate-300 dark:border-slate-700'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                        }`}
                >
                    Foundation Design
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[600px]">
                {activeTab === 'rc' && <RCDesignPanel />}
                {activeTab === 'foundation' && <FoundationDesignPanel />}
            </div>
        </div>
    );
};

export default DetailingDesignPage;
