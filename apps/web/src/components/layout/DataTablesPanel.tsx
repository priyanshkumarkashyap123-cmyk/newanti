/**
 * DataTablesPanel - Bottom Collapsible Data Tables
 * 
 * Tabbed data view for Nodes, Members, Loads, etc.
 */

import React from 'react';
import { FC, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Table, Circle, Box, ArrowDown, Hammer } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DataTablesPanelProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    nodes?: Array<{ id: string; x: number; y: number; z: number }>;
    members?: Array<{ id: string; startNode: string; endNode: string }>;
    loads?: Array<{ id: string; nodeId: string; fx: number; fy: number }>;
    virtualizationThreshold?: number;
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
        loads = [],
    virtualizationThreshold = 200,
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('nodes');
    const MAX_ROWS = 500;

    const visibleNodes = nodes.slice(0, MAX_ROWS);
    const visibleMembers = members.slice(0, MAX_ROWS);
    const visibleLoads = Array.isArray(loads) ? loads.slice(0, MAX_ROWS) : [];
    const shouldVirtualize = Math.max(nodes.length, members.length, Array.isArray(loads) ? loads.length : 0) > virtualizationThreshold;
    const rowCountHint = useMemo(() => ({
        nodes: visibleNodes.length,
        members: visibleMembers.length,
        loads: visibleLoads.length,
    }), [visibleNodes.length, visibleMembers.length, visibleLoads.length]);

    const tabs: { id: TabId; label: string; icon: React.ElementType; count: number }[] = [
        { id: 'nodes', label: 'Nodes', icon: Circle, count: nodes.length },
        { id: 'members', label: 'Members', icon: Box, count: members.length },
        { id: 'loads', label: 'Loads', icon: ArrowDown, count: Array.isArray(loads) && loads.length > 0 ? loads.length : 0 },
        { id: 'supports', label: 'Supports', icon: Hammer, count: 0 }
    ];

    if (isCollapsed) {
        return (
            <div
                className="h-10 bg-slate-900 text-slate-100 border-t border-slate-800 flex items-center justify-between px-4"
                role="region"
                aria-label="Model data summary"
            >
                <div className="flex items-center gap-4">
                    {tabs.map(tab => (
                        <span key={tab.id} className="text-xs text-[#869ab8]">
                            {tab.label}: <span className="font-medium tracking-wide text-[#adc6ff]">{tab.count}</span>
                        </span>
                    ))}
                </div>
                <button type="button"
                    onClick={onToggleCollapse}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                    aria-label="Expand data tables"
                >
                    <ChevronUp className="w-4 h-4 text-[#869ab8]" aria-hidden="true" />
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-900 text-slate-100 border-t border-slate-800" role="region" aria-label="Model data tables">
            {/* Tab Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50">
                <div className="flex">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button type="button"
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium tracking-wide border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2 ${isActive
                                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                    : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${isActive ? 'bg-blue-500/20 text-blue-100' : 'bg-slate-800 text-slate-300'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <button type="button"
                    onClick={onToggleCollapse}
                    className="p-2 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
                    aria-label="Collapse data tables"
                >
                    <ChevronDown className="w-4 h-4 text-slate-300" aria-hidden="true" />
                </button>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto">
                {shouldVirtualize && (
                    <div className="px-4 py-2 text-[11px] text-slate-400 border-b border-slate-800 bg-slate-950/40">
                        Large dataset detected. Showing the first {MAX_ROWS} rows per tab for responsiveness. Visible rows: nodes {rowCountHint.nodes}, members {rowCountHint.members}, loads {rowCountHint.loads}.
                    </div>
                )}
                <table className="w-full text-xs text-slate-100" aria-live="polite">
                    <caption className="sr-only">Model data table</caption>
                    <thead className="bg-slate-800 sticky top-0">
                        {activeTab === 'nodes' && (
                            <tr>
                                <th className="px-4 py-2 text-left font-medium tracking-wide text-slate-300">ID</th>
                                <th className="px-4 py-2 text-right font-medium tracking-wide text-slate-300">X (m)</th>
                                <th className="px-4 py-2 text-right font-medium tracking-wide text-slate-300">Y (m)</th>
                                <th className="px-4 py-2 text-right font-medium tracking-wide text-slate-300">Z (m)</th>
                            </tr>
                        )}
                        {activeTab === 'members' && (
                            <tr>
                                <th className="px-4 py-2 text-left font-medium tracking-wide text-slate-300">ID</th>
                                <th className="px-4 py-2 text-left font-medium tracking-wide text-slate-300">Start</th>
                                <th className="px-4 py-2 text-left font-medium tracking-wide text-slate-300">End</th>
                                <th className="px-4 py-2 text-right font-medium tracking-wide text-slate-300">Length</th>
                            </tr>
                        )}
                        {activeTab === 'loads' && Array.isArray(loads) && (
                            <tr>
                                <th className="px-4 py-2 text-left font-medium tracking-wide text-slate-300">ID</th>
                                <th className="px-4 py-2 text-left font-medium tracking-wide text-slate-300">Node</th>
                                <th className="px-4 py-2 text-right font-medium tracking-wide text-slate-300">Fx (kN)</th>
                                <th className="px-4 py-2 text-right font-medium tracking-wide text-slate-300">Fy (kN)</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                             {activeTab === 'nodes' && visibleNodes.map((node, idx) => (
                            <tr key={node.id} className={idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/80'}>
                                <td className="px-4 py-1.5 font-mono text-slate-100">{node.id}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-300">{node.x.toFixed(3)}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-300">{node.y.toFixed(3)}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-300">{node.z.toFixed(3)}</td>
                            </tr>
                        ))}
                             {activeTab === 'members' && visibleMembers.map((member, idx) => (
                            <tr key={member.id} className={idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/80'}>
                                <td className="px-4 py-1.5 font-mono text-slate-100">{member.id}</td>
                                <td className="px-4 py-1.5 text-slate-300">{member.startNode}</td>
                                <td className="px-4 py-1.5 text-slate-300">{member.endNode}</td>
                                <td className="px-4 py-1.5 text-right font-mono text-slate-300">-</td>
                            </tr>
                        ))}
                             {(activeTab === 'nodes' && nodes.length === 0) && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-[#869ab8]">No nodes defined</td>
                            </tr>
                        )}
                             {(activeTab === 'members' && members.length === 0) && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-[#869ab8]">No members defined</td>
                            </tr>
                        )}
                             {activeTab === 'loads' && Array.isArray(loads) && visibleLoads.map((load: any, idx) => (
                                 <tr key={load.id ?? idx} className={idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/80'}>
                                     <td className="px-4 py-1.5 font-mono text-slate-100">{load.id ?? `L${idx + 1}`}</td>
                                     <td className="px-4 py-1.5 text-slate-300">{load.nodeId ?? '-'}</td>
                                     <td className="px-4 py-1.5 text-right font-mono text-slate-300">{Number(load.fx ?? 0).toFixed(2)}</td>
                                     <td className="px-4 py-1.5 text-right font-mono text-slate-300">{Number(load.fy ?? 0).toFixed(2)}</td>
                                 </tr>
                             ))}
                             {activeTab === 'loads' && Array.isArray(loads) && loads.length > MAX_ROWS && (
                                 <tr>
                                     <td colSpan={4} className="px-4 py-2 text-center text-[10px] text-slate-500">Showing first {MAX_ROWS} loads</td>
                                 </tr>
                             )}
                             {activeTab === 'loads' && Array.isArray(loads) && loads.length === 0 && (
                                 <tr>
                                     <td colSpan={4} className="px-4 py-8 text-center text-[#869ab8]">No loads defined</td>
                                 </tr>
                             )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DataTablesPanel;
