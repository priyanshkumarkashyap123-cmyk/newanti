/**
 * WorkspaceDemo - Demo page showing the new Engineering Workspace
 * Temporary page to demonstrate the advanced UI templates
 */

import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    EngineeringWorkspace,
    ViewportPanel,
    PropertiesPanel,
    ResultsPanel,
} from '../components/workspace';
import { DataTable, StatusBadge } from '../components/ui';

// Sample data for demonstration
const sampleReactions = [
    { node: 'N1', lc: 'DL', fx: 0.0, fy: -125.4, fz: 0.0, status: 'pass' as const },
    { node: 'N2', lc: 'DL', fx: 0.0, fy: -98.7, fz: 0.0, status: 'pass' as const },
    { node: 'N3', lc: 'LL', fx: -15.2, fy: -203.1, fz: 0.0, status: 'warning' as const },
    { node: 'N4', lc: 'LL', fx: 15.2, fy: -189.5, fz: 0.0, status: 'pass' as const },
];

const sampleForces = [
    { member: 'M1', axial: -145.2, shear: 23.1, moment: 45.8, status: 'pass' as const },
    { member: 'M2', axial: -132.6, shear: -18.4, moment: -38.2, status: 'pass' as const },
    { member: 'M3', axial: -98.4, shear: 42.7, moment: 89.3, status: 'fail' as const },
];

export const WorkspaceDemo: FC = () => {
    const [showTutorial, setShowTutorial] = useState(false);
    const [selectedSection, setSelectedSection] = useState('W12x26');
    const [selectedMaterial, setSelectedMaterial] = useState('A992');

    return (
        <EngineeringWorkspace
            showTutorial={showTutorial}
            onTutorialClose={() => setShowTutorial(false)}
            propertiesPanel={
                <PropertiesPanel
                    title="Properties"
                    sections={[
                        {
                            id: 'member',
                            title: 'Member Properties',
                            badge: 'M-102',
                            defaultOpen: true,
                            content: (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Material</label>
                                        <select
                                            value={selectedMaterial}
                                            onChange={(e) => setSelectedMaterial(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="A992">Steel A992</option>
                                            <option value="A36">Steel A36</option>
                                            <option value="A572">Steel A572 Gr. 50</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Section</label>
                                        <select
                                            value={selectedSection}
                                            onChange={(e) => setSelectedSection(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="W12x26">W12x26</option>
                                            <option value="W14x22">W14x22</option>
                                            <option value="W16x31">W16x31</option>
                                            <option value="W18x35">W18x35</option>
                                        </select>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Properties</div>
                                        <div className="space-y-1 text-xs font-mono">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 dark:text-slate-400">A:</span>
                                                <span className="text-slate-900 dark:text-white">7.65 in²</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 dark:text-slate-400">I<sub>x</sub>:</span>
                                                <span className="text-slate-900 dark:text-white">204 in⁴</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 dark:text-slate-400">S<sub>x</sub>:</span>
                                                <span className="text-slate-900 dark:text-white">33.4 in³</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'loads',
                            title: 'Active Loads',
                            badge: '3',
                            defaultOpen: false,
                            content: (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-300">DL (Dead Load)</span>
                                        <span className="text-green-400">Active</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-300">LL (Live Load)</span>
                                        <span className="text-green-400">Active</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-300">EQ (Earthquake)</span>
                                        <span className="text-slate-500 dark:text-slate-400">Inactive</span>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'analysis',
                            title: 'Analysis Settings',
                            defaultOpen: false,
                            content: (
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">Type:</span>
                                        <span className="text-slate-900 dark:text-white">Linear Static</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">Solver:</span>
                                        <span className="text-slate-900 dark:text-white">Direct</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">P-Delta:</span>
                                        <span className="text-blue-400">Enabled</span>
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />
            }
            resultsPanel={
                <ResultsPanel
                    tabs={[
                        {
                            id: 'reactions',
                            label: 'Reactions',
                            badge: sampleReactions.length,
                            content: (
                                <div className="p-2">
                                    <DataTable
                                        columns={[
                                            { accessor: 'node', header: 'Node' },
                                            { accessor: 'lc', header: 'LC' },
                                            {
                                                accessor: 'fx',
                                                header: 'FX (kN)',
                                                cell: ({ row }: any) => (
                                                    <span className={row.original.fx === 0 ? 'text-slate-500' : 'text-slate-900 dark:text-white'}>
                                                        {row.original.fx.toFixed(1)}
                                                    </span>
                                                ),
                                            },
                                            {
                                                accessor: 'fy',
                                                header: 'FY (kN)',
                                                cell: ({ row }: any) => (
                                                    <span className="text-slate-900 dark:text-white font-semibold">{row.original.fy.toFixed(1)}</span>
                                                ),
                                            },
                                            {
                                                accessor: 'fz',
                                                header: 'FZ (kN)',
                                                cell: ({ row }: any) => (
                                                    <span className={row.original.fz === 0 ? 'text-slate-500' : 'text-slate-900 dark:text-white'}>
                                                        {row.original.fz.toFixed(1)}
                                                    </span>
                                                ),
                                            },
                                            {
                                                accessor: 'status',
                                                header: 'Status',
                                                cell: ({ row }: any) => (
                                                    <StatusBadge variant={row.original.status} size="sm">
                                                        {row.original.status.toUpperCase()}
                                                    </StatusBadge>
                                                ),
                                            },
                                        ]}
                                        data={sampleReactions}
                                        highlightRow={(row) => row.status === 'warning' ? 'bg-yellow-500/10' : false}
                                        compact
                                    />
                                </div>
                            ),
                        },
                        {
                            id: 'forces',
                            label: 'Member Forces',
                            badge: sampleForces.length,
                            content: (
                                <div className="p-2">
                                    <DataTable
                                        columns={[
                                            { accessor: 'member', header: 'Member' },
                                            {
                                                accessor: 'axial',
                                                header: 'Axial (kN)',
                                                cell: ({ row }: any) => (
                                                    <span className={row.original.axial < 0 ? 'text-blue-400' : 'text-red-400'}>
                                                        {row.original.axial.toFixed(1)}
                                                    </span>
                                                ),
                                            },
                                            { accessor: 'shear', header: 'Shear (kN)', cell: ({ row }: any) => row.original.shear.toFixed(1) },
                                            { accessor: 'moment', header: 'Moment (kN·m)', cell: ({ row }: any) => row.original.moment.toFixed(1) },
                                            {
                                                accessor: 'status',
                                                header: 'Check',
                                                cell: ({ row }: any) => (
                                                    <StatusBadge variant={row.original.status} size="sm">
                                                        {row.original.status === 'pass' ? '✓' : '✗'}
                                                    </StatusBadge>
                                                ),
                                            },
                                        ]}
                                        data={sampleForces}
                                        highlightRow={(row) => row.status === 'fail' ? 'bg-red-900/10' : false}
                                        compact
                                    />
                                </div>
                            ),
                        },
                        {
                            id: 'report',
                            label: 'Report',
                            content: (
                                <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                        <span className="material-symbols-outlined text-5xl text-slate-700">description</span>
                                        <p className="text-sm">Report generation coming soon</p>
                                        <button className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold">
                                            Generate PDF
                                        </button>
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />
            }
        >
            <ViewportPanel
                coordinates={{ x: 0, y: 0, z: 0 }}
                showGrid
                showAxes
                overlayInfo={[
                    { label: 'Material', value: selectedMaterial },
                    { label: 'Section', value: selectedSection },
                    { label: 'Length', value: '6.0 m' },
                ]}
            >
                {/* Placeholder for 3D viewport */}
                <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                    <span className="material-symbols-outlined text-[120px] text-slate-700">deployed_code</span>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-500 dark:text-slate-400 mb-2">
                            3D Viewport Ready
                        </h2>
                        <p className="text-sm text-slate-500 max-w-md">
                            The workspace layout is complete. Integrate your Three.js canvas here to display the structural model.
                        </p>
                        <Link
                            to="/demo"
                            className="inline-block mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                        >
                            Go to Actual Demo →
                        </Link>
                    </div>
                    <button
                        onClick={() => setShowTutorial(true)}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                    >
                        Show Tutorial Modal
                    </button>
                </div>
            </ViewportPanel>
        </EngineeringWorkspace>
    );
};

export default WorkspaceDemo;
