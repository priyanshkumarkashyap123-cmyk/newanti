/**
 * DataTablesPanel - Bottom Collapsible Data Tables
 * 
 * Tabbed data view for Nodes, Members, Loads, etc.
 */

import React from 'react';
import { FC, useState } from 'react';
import { ChevronUp, ChevronDown, Table, Circle, Box, ArrowDown, Hammer } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DataTablesPanelProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    nodes?: Array<{ id: string; x: number; y: number; z: number }>;
    members?: Array<{ id: string; startNode: string; endNode: string }>;
    loads?: Array<{ id: string; nodeId: string; magnitude: number }>;
}

type TabId = 'nodes' | 'members' | 'loads' | 'supports';

// ============================================
// COMPONENT
// ============================================

export const DataTablesPanel: FC<DataTablesPanelProps> = ({
    isCollapsed,
    onToggleCollapse,
    nodes = [],
    members = [],
    loads = []
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('nodes');

    const tabs: { id: TabId; label: string; icon: React.ElementType; count: number }[] = [
        { id: 'nodes', label: 'Nodes', icon: Circle, count: nodes.length },
        { id: 'members', label: 'Members', icon: Box, count: members.length },
        { id: 'loads', label: 'Loads', icon: ArrowDown, count: loads.length },
        { id: 'supports', label: 'Supports', icon: Hammer, count: 0 }
    ];

    if (isCollapsed) {
        return (
            <div className="h-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    {tabs.map(tab => (
                        <span key={tab.id} className="text-xs text-slate-500 dark:text-slate-400">
                            {tab.label}: <span className="font-medium text-slate-700 dark:text-slate-300">{tab.count}</span>
                        </span>
                    ))}
                </div>
                <button type="button"
                    onClick={onToggleCollapse}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                >
                    <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            {/* Tab Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="flex">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button type="button"
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${isActive
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${isActive ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <button type="button"
                    onClick={onToggleCollapse}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                        {activeTab === 'nodes' && (
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">ID</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">X (m)</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">Y (m)</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">Z (m)</th>
                            </tr>
                        )}
                        {activeTab === 'members' && (
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">ID</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Start</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">End</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">Length</th>
                            </tr>
                        )}
                        {activeTab === 'loads' && (
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">ID</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Node</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">Fx (kN)</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-500 dark:text-slate-400">Fy (kN)</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {activeTab === 'nodes' && nodes.map((node, idx) => (
                            <tr key={node.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}>
                                <td className="px-4 py-1.5 font-mono text-slate-700 dark:text-slate-300">{node.id}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400">{node.x.toFixed(3)}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400">{node.y.toFixed(3)}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400">{node.z.toFixed(3)}</td>
                            </tr>
                        ))}
                        {activeTab === 'members' && members.map((member, idx) => (
                            <tr key={member.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}>
                                <td className="px-4 py-1.5 font-mono text-slate-700 dark:text-slate-300">{member.id}</td>
                                <td className="px-4 py-1.5 text-slate-500 dark:text-slate-400">{member.startNode}</td>
                                <td className="px-4 py-1.5 text-slate-500 dark:text-slate-400">{member.endNode}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400">-</td>
                            </tr>
                        ))}
                        {(activeTab === 'nodes' && nodes.length === 0) && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">No nodes defined</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DataTablesPanel;
