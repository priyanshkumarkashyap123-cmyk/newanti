import React, { useState, lazy, Suspense } from 'react';
import { OpenChannelFlowCalculator, PipeFlowCalculator } from './HydraulicsUI';

const PipeNetworkDesigner = lazy(() => import('./PipeNetworkDesigner'));

export function HydraulicsDesigner() {
    const [activeTab, setActiveTab] = useState<'open-channel' | 'pipe-flow' | 'pipe-network'>('open-channel');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h1 className="text-2xl font-bold text-slate-900">Hydraulics Engineering</h1>
                <p className="text-slate-500 mt-1">Water Resources, Channel Flow & Pipe Network Analysis</p>

                {/* Tabs */}
                <div className="flex gap-2 mt-6 border-b border-slate-200">
                    <button type="button"
                        onClick={() => setActiveTab('open-channel')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'open-channel'
                                ? 'border-cyan-500 text-cyan-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Open Channel Flow
                    </button>
                    <button type="button"
                        onClick={() => setActiveTab('pipe-flow')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pipe-flow'
                                ? 'border-cyan-500 text-cyan-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Pipe Flow
                    </button>
                    <button type="button"
                        onClick={() => setActiveTab('pipe-network')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pipe-network'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Pipe Network Design
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1">
                {activeTab === 'open-channel' && <OpenChannelFlowCalculator />}
                {activeTab === 'pipe-flow' && <PipeFlowCalculator />}
                {activeTab === 'pipe-network' && (
                    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">Loading Pipe Network Designer...</div>}>
                        <PipeNetworkDesigner />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
