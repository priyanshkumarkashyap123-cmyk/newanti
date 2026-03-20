/**
 * EngineeringWorkspace - Professional structural engineering workspace
 * Full-screen layout with viewport, properties panel, results panel, and tool palette
 * 
 * Based on advanced template with dark theme and professional UI
 */

import { FC, ReactNode, useState } from 'react';

export interface EngineeringWorkspaceProps {
    children: ReactNode; // Main 3D viewport content
    propertiesPanel?: ReactNode;
    resultsPanel?: ReactNode;
    showTutorial?: boolean;
    onTutorialClose?: () => void;
}

export const EngineeringWorkspace: FC<EngineeringWorkspaceProps> = ({
    children,
    propertiesPanel,
    resultsPanel,
    showTutorial = false,
    onTutorialClose,
}) => {
    const [activeTool, setActiveTool] = useState('select');

    const tools = [
        { id: 'select', icon: 'near_me', tooltip: 'Select' },
        { id: 'beam', icon: 'maximize', tooltip: 'Draw Beam' },
        { id: 'node', icon: 'circle', tooltip: 'Add Node' },
        { id: 'support', icon: 'change_history', tooltip: 'Support' },
        { id: 'load', icon: 'arrow_downward', tooltip: 'Load' },
        { id: 'dimension', icon: 'straighten', tooltip: 'Dimension' },
    ];

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[#0b1326] text-[#dae2fd] font-display">
            {/* Top Menu Bar */}
            <header className="h-[30px] bg-[#131b2e] border-b border-[#1a2333] flex items-center px-4 justify-between shrink-0 select-none z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-[#dae2fd] font-bold text-xs tracking-wider uppercase">
                        <span className="material-symbols-outlined text-blue-500 text-[16px]">architecture</span>
                        BeamLab
                    </div>
                    <nav className="flex items-center gap-4">
                        {['File', 'Edit', 'View', 'Analyze', 'Design'].map((item) => (
                            <span
                                key={item}
                                className="text-xs font-medium tracking-wide tracking-wide text-slate-600 dark:text-slate-300 cursor-default"
                            >
                                {item}
                            </span>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#869ab8]">v4.2.0-pro</span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Tool Palette */}
                <aside className="w-[50px] bg-[#131b2e] border-r border-[#1a2333] flex flex-col items-center py-2 gap-2 shrink-0 z-40">
                    {tools.map((tool) => (
                        <button type="button"
                            key={tool.id}
                            onClick={() => setActiveTool(tool.id)}
                            className={`
                                w-8 h-8 flex items-center justify-center rounded transition-all group relative
                                ${activeTool === tool.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-[#869ab8] hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                                }
                            `}
                        >
                            <span className="material-symbols-outlined text-[20px]">{tool.icon}</span>
                            <div className="absolute left-10 bg-[#0b1326] text-xs px-2 py-1 rounded border border-[#1a2333] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                {tool.tooltip}
                            </div>
                        </button>
                    ))}
                    <div className="h-px w-6 bg-slate-200 dark:bg-slate-700 my-1"></div>
                    <button type="button" className="w-8 h-8 flex items-center justify-center rounded text-[#869ab8] hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors group relative">
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                    </button>
                </aside>

                {/* Main Content Area - Grid Layout */}
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 flex overflow-hidden">
                        {/* Center: Viewport Area */}
                        <div className="flex-1 flex flex-col min-w-0">
                            {/* 3D Viewport */}
                            <div className={`${resultsPanel ? 'flex-[2]' : 'flex-1'} relative bg-[#0b1326] overflow-hidden`}>
                                {children}
                            </div>

                            {/* Results Panel (Bottom) */}
                            {resultsPanel && (
                                <div className="flex-1 bg-[#131b2e] border-t border-[#1a2333] flex flex-col min-h-[200px]">
                                    {resultsPanel}
                                </div>
                            )}
                        </div>

                        {/* Properties Panel (Right) */}
                        {propertiesPanel && (
                            <div className="w-[300px] bg-[#131b2e] border-l border-[#1a2333] overflow-y-auto shrink-0">
                                {propertiesPanel}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <footer className="h-8 bg-[#0b1326] border-t border-[#1a2333] flex items-center justify-between px-4 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs text-[#869ab8]">Ready</span>
                    </div>
                    <div className="h-3 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <span className="text-xs text-[#869ab8] font-mono">X: 0.00 Y: 0.00 Z: 0.00</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-[#869ab8]">0 Nodes, 0 Members</span>
                    <div className="h-3 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <span className="text-xs text-[#869ab8]">Memory: 45MB</span>
                </div>
            </footer>

            {/* Tutorial Overlay Modal */}
            {showTutorial && (
                <div className="fixed inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-[#131b2e] border border-[#1a2333] rounded-xl shadow-2xl shadow-black max-w-lg w-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700">
                            <div className="h-full bg-blue-500 w-full"></div>
                        </div>
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-green-400 text-[32px]">check_circle</span>
                            </div>
                            <h2 className="text-2xl font-bold text-[#dae2fd] mb-3">Welcome to BeamLab!</h2>
                            <p className="text-slate-600 dark:text-slate-300 text-lg mb-8 leading-relaxed">
                                Start creating your first structural model now.
                            </p>
                            <div className="w-full flex items-center justify-between mt-4">
                                <span className="text-xs font-semibold text-[#869ab8] uppercase tracking-wider">Getting Started</span>
                                <button type="button"
                                    onClick={onTutorialClose}
                                    className="bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] font-bold py-3 px-8 rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                                >
                                    Got It!
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EngineeringWorkspace;
