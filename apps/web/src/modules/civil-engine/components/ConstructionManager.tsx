/**
 * ConstructionManager.tsx
 * 
 * UI for Construction Management & Planning
 * - CPM/PERT Scheduling with Gantt Chart visualization
 * - Cost Estimation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { construction, Activity, CostEstimate, ScheduleResult } from '../services/civil/ConstructionManagementService';

export function ConstructionManager() {
    const [activeTab, setActiveTab] = useState<'schedule' | 'cost'>('schedule');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h1 className="text-2xl font-bold text-gray-900">Construction Management</h1>
                <p className="text-gray-500 mt-1">Project Scheduling, Estimating & Risk Analysis</p>

                {/* Tabs */}
                <div className="flex gap-2 mt-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'schedule'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Schedule (CPM/PERT)
                    </button>
                    <button
                        onClick={() => setActiveTab('cost')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cost'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Cost Estimation
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1">
                {activeTab === 'schedule' && <SchedulePanel />}
                {activeTab === 'cost' && <CostPanel />}
            </div>
        </div>
    );
}

// =============================================================================
// SCHEDULE PANEL (CPM/PERT + GANTT)
// =============================================================================

function SchedulePanel() {
    const [activities, setActivities] = useState<Activity[]>([
        { id: 'A', name: 'Site Clearing', duration: 3, predecessors: [] },
        { id: 'B', name: 'Excavation', duration: 5, predecessors: ['A'] },
        { id: 'C', name: 'Foundation PCC', duration: 4, predecessors: ['B'] },
        { id: 'D', name: 'Foundation RCC', duration: 7, predecessors: ['C'] },
        { id: 'E', name: 'Plinth Beam', duration: 5, predecessors: ['D'] },
        { id: 'F', name: 'Column Raising', duration: 10, predecessors: ['E'] },
        { id: 'G', name: 'Brickwork', duration: 12, predecessors: ['F'] },
        { id: 'H', name: 'Roof Slab', duration: 8, predecessors: ['G'] },
    ]);

    const [schedule, setSchedule] = useState<ScheduleResult | null>(null);

    const calculate = useCallback(() => {
        try {
            const res = construction.calculateCPM(activities);
            queueMicrotask(() => setSchedule(res));
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            alert('Error calculating schedule: ' + error);
        }
    }, [activities]);

    useEffect(() => {
        // Initial calculation
        calculate();
    }, [calculate]);

    const addActivity = () => {
        const id = String.fromCharCode(65 + activities.length); // Next letter
        setActivities([...activities, { id, name: 'New Task', duration: 1, predecessors: [] }]);
    };

    const updateActivity = (index: number, field: keyof Activity, value: string | number | string[]) => {
        const newActs = [...activities];
        if (field === 'predecessors') {
            const predecessorsValue = typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : value as string[];
            newActs[index] = { ...newActs[index], predecessors: predecessorsValue };
        } else if (field === 'duration') {
            newActs[index] = { ...newActs[index], duration: value as number };
        } else {
            newActs[index] = { ...newActs[index], [field]: value as string };
        }
        setActivities(newActs);
    };

    const deleteActivity = (index: number) => {
        const newActs = [...activities];
        newActs.splice(index, 1);
        setActivities(newActs);
    };

    return (
        <div className="space-y-6">
            {/* Activity Input Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Activity List</h3>
                    <button onClick={addActivity} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">
                        + Add Activity
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600 font-semibold">
                            <tr>
                                <th className="px-4 py-2 w-16">ID</th>
                                <th className="px-4 py-2">Activity Name</th>
                                <th className="px-4 py-2 w-24">Dur (days)</th>
                                <th className="px-4 py-2 w-32">Predecessors</th>
                                <th className="px-4 py-2 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {activities.map((act, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-mono bg-gray-50">{act.id}</td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={act.name}
                                            onChange={e => updateActivity(idx, 'name', e.target.value)}
                                            className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            value={act.duration}
                                            onChange={e => updateActivity(idx, 'duration', Number(e.target.value))}
                                            className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={act.predecessors.join(', ')}
                                            onChange={e => updateActivity(idx, 'predecessors', e.target.value)}
                                            placeholder="e.g. A, B"
                                            className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => deleteActivity(idx)} className="text-red-400 hover:text-red-600 px-1">×</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t">
                    <button onClick={calculate} className="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700">
                        Apply Changes & Recalculate
                    </button>
                </div>
            </div>

            {/* Results & Gantt */}
            {schedule && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Project Schedule</h3>
                            <p className="text-sm text-gray-500">Duration: {schedule.projectDuration} days | Critical Path: {schedule.criticalPath.join(' → ')}</p>
                        </div>
                    </div>

                    {/* Simple Gantt Chart */}
                    <div className="overflow-x-auto border rounded-lg bg-white relative">
                        <div className="min-w-[800px] p-4">
                            {/* Timeline Header */}
                            <div className="flex h-8 mb-2 border-b">
                                <div className="w-48 shrink-0"></div>
                                <div className="flex-1 flex relative">
                                    {Array.from({ length: schedule.projectDuration + 2 }).map((_, i) => (
                                        <div key={i} className="absolute text-[10px] text-gray-500 dark:text-gray-400 border-l h-full pl-1" style={{ left: `${(i / schedule.projectDuration) * 100}%` }}>
                                            {i}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bars */}
                            <div className="space-y-3">
                                {activities.map((act) => {
                                    const s = schedule.activities.find(x => x.id === act.id);
                                    if (!s) return null;

                                    const left = (s.ES / schedule.projectDuration) * 100;
                                    const width = (act.duration / schedule.projectDuration) * 100;
                                    const color = s.isCritical ? 'bg-red-500' : 'bg-blue-500';
                                    const opacity = s.isCritical ? 'bg-red-100' : 'bg-blue-100';

                                    return (
                                        <div key={act.id} className="flex items-center h-8 group hover:bg-gray-50">
                                            <div className="w-48 shrink-0 text-sm font-medium px-2 truncate flex items-center justify-between">
                                                <span>{act.id} - {act.name}</span>
                                                {s.isCritical && <span className="text-[10px] text-red-500 font-bold px-1 rounded bg-red-50">CRIT</span>}
                                            </div>
                                            <div className="flex-1 relative h-full">
                                                {/* Task Bar */}
                                                <div
                                                    className={`absolute top-1.5 h-5 rounded ${color} shadow-sm border border-slate-200 dark:border-white transition-all`}
                                                    style={{ left: `${left}%`, width: `${width}%` }}
                                                    title={`Start: ${s.ES}, Fin: ${s.EF}, Dur: ${act.duration}`}
                                                >
                                                    <span className="text-[10px] text-slate-900 dark:text-white px-1 ml-1 truncate absolute inset-0 flex items-center">{act.duration}d</span>
                                                </div>

                                                {/* Float Bar (if any) */}
                                                {s.TF > 0 && (
                                                    <div
                                                        className={`absolute top-2.5 h-3 rounded-r ${opacity} border-l border-dashed border-gray-400`}
                                                        style={{
                                                            left: `${((s.ES + act.duration) / schedule.projectDuration) * 100}%`,
                                                            width: `${(s.TF / schedule.projectDuration) * 100}%`
                                                        }}
                                                        title={`Total Float: ${s.TF} days`}
                                                    ></div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-4 text-xs text-gray-500 justify-end">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> Critical Path</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded"></div> Standard Task</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 rounded"></div> Float / Slack</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// COST ESTIMATION PANEL
// =============================================================================

function CostPanel() {
    const [params, setParams] = useState({
        area: 1200, // sq ft
        floors: 2,
        type: 'residential' as 'residential' | 'commercial' | 'industrial'
    });

    const [estimate, setEstimate] = useState<CostEstimate | null>(null);

    const calculate = () => {
        // Convert sq ft to m2 approx
        const areaM2 = params.area / 10.764;
        const items = construction.estimateBuildingQuantities(areaM2, params.floors, params.type);
        const est = construction.createEstimate(items);
        setEstimate(est);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Estimates</h3>
                <p className="text-sm text-gray-500 mb-6">Generates an approximate BOQ based on plinth area rates.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Built-up Area (sq. ft.)</label>
                        <input
                            type="number"
                            value={params.area}
                            onChange={e => setParams({ ...params, area: Number(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Floors</label>
                        <input
                            type="number"
                            value={params.floors}
                            onChange={e => setParams({ ...params, floors: Number(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Building Type</label>
                        <select
                            value={params.type}
                            onChange={e => setParams({ ...params, type: e.target.value as 'residential' | 'commercial' | 'industrial' })}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="residential">Residential</option>
                            <option value="commercial">Commercial</option>
                            <option value="industrial">Industrial</option>
                        </select>
                    </div>

                    <button
                        onClick={calculate}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 mt-2"
                    >
                        Generate Detailed Estimate
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {estimate && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 bg-gray-50 dark:bg-gray-900 text-slate-900 dark:text-white">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Total Project Estimate</div>
                            <div className="text-3xl font-bold">₹ {estimate.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Includes {(estimate.totalIndirect / estimate.totalDirect * 100).toFixed(0)}% overheads & contingencies</div>
                        </div>

                        <div className="p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Item Description</th>
                                        <th className="px-4 py-2 text-right">Qty</th>
                                        <th className="px-4 py-2 text-right">Rate</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {estimate.directCosts.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 font-medium">{item.description}</td>
                                            <td className="px-4 py-2 text-right text-gray-600">{Math.round(item.quantity)} {item.unit}</td>
                                            <td className="px-4 py-2 text-right text-gray-600">₹{item.unitRate}</td>
                                            <td className="px-4 py-2 text-right font-semibold">₹{Math.round(item.amount).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-semibold text-gray-800">
                                        <td className="px-4 py-2" colSpan={3}>Subtotal (Direct Costs)</td>
                                        <td className="px-4 py-2 text-right">₹{Math.round(estimate.totalDirect).toLocaleString('en-IN')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
