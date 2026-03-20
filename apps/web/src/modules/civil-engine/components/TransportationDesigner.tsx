import React, { useState, useEffect, useRef } from 'react';
import { transportation, RoadClass, TerrainType, PavementType } from '../services/civil/TransportationService';
import { generateCivilReport } from '../../../services/PDFReportService';

export function TransportationDesigner() {
    const [activeTab, setActiveTab] = useState<'highway' | 'pavement' | 'intersection'>('highway');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h1 className="text-2xl font-bold text-slate-900">Transportation Engineering</h1>
                <p className="text-slate-500 mt-1">Highway Geometric Design, Pavement Design & Traffic Analysis</p>

                {/* Tabs */}
                <div className="flex gap-2 mt-6 border-b border-slate-200">
                    <button type="button"
                        onClick={() => setActiveTab('highway')}
                        className={`px-4 py-2 text-sm font-medium tracking-wide tracking-wide border-b-2 transition-colors ${activeTab === 'highway'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Highway Design
                    </button>
                    <button type="button"
                        onClick={() => setActiveTab('pavement')}
                        className={`px-4 py-2 text-sm font-medium tracking-wide tracking-wide border-b-2 transition-colors ${activeTab === 'pavement'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Pavement Design
                    </button>
                    <button type="button"
                        onClick={() => setActiveTab('intersection')}
                        className={`px-4 py-2 text-sm font-medium tracking-wide tracking-wide border-b-2 transition-colors ${activeTab === 'intersection'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Intersection Analysis
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'highway' && <HighwayDesignPanel />}
                {activeTab === 'pavement' && <PavementDesignPanel />}
                {activeTab === 'intersection' && <IntersectionAnalysisPanel />}
            </div>
        </div>
    );
}

// =============================================================================
// HIGHWAY DESIGN PANEL
// =============================================================================

function HighwayDesignPanel() {
    const [params, setParams] = useState({
        roadClass: 'national_highway' as RoadClass,
        terrain: 'plain' as TerrainType,
        speed: 100, // will be auto-updated
        deflectionAngle: 45,
        grade1: 2.5,
        grade2: -1.5,
    });

    const [curveResult, setCurveResult] = useState<any>(null);
    const [verticalResult, setVerticalResult] = useState<any>(null);

    // Auto-update design speed when class/terrain changes
    useEffect(() => {
        const speed = transportation.getDesignSpeed(params.roadClass, params.terrain);
        queueMicrotask(() => {
            setParams(p => ({ ...p, speed }));
        });
    }, [params.roadClass, params.terrain]);

    const calculate = () => {
        const curve = transportation.designHorizontalCurve(
            params.speed,
            params.deflectionAngle
        );

        const vertical = transportation.designVerticalCurve(
            params.grade1 > params.grade2 ? 'crest' : 'sag',
            params.grade1,
            params.grade2,
            params.speed
        );

        setCurveResult(curve);
        setVerticalResult(vertical);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Design Parameters</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium tracking-wide tracking-wide text-slate-700 mb-1">Road Class</label>
                            <select
                                value={params.roadClass}
                                onChange={e => setParams({ ...params, roadClass: e.target.value as RoadClass })}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            >
                                <option value="expressway">Expressway</option>
                                <option value="national_highway">National Highway</option>
                                <option value="state_highway">State Highway</option>
                                <option value="major_district">Major District Road</option>
                                <option value="other_district">Other District Road</option>
                                <option value="village">Village Road</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium tracking-wide tracking-wide text-slate-700 mb-1">Terrain</label>
                            <select
                                value={params.terrain}
                                onChange={e => setParams({ ...params, terrain: e.target.value as TerrainType })}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            >
                                <option value="plain">Plain</option>
                                <option value="rolling">Rolling</option>
                                <option value="hilly">Hilly</option>
                                <option value="steep">Steep</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg flex justify-between items-center">
                        <span className="text-sm text-orange-800 font-medium tracking-wide tracking-wide">Design Speed (IRC 73)</span>
                        <span className="text-xl font-bold text-orange-700">{params.speed} km/h</span>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3">Horizontal Alignment</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Deflection Angle (degrees)</label>
                                <input
                                    type="number"
                                    value={params.deflectionAngle}
                                    onChange={e => setParams({ ...params, deflectionAngle: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3">Vertical Alignment</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Incoming Grade (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={params.grade1}
                                    onChange={e => setParams({ ...params, grade1: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Outgoing Grade (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={params.grade2}
                                    onChange={e => setParams({ ...params, grade2: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    <button type="button"
                        onClick={calculate}
                        className="w-full py-2.5 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 shadow-sm"
                    >
                        Calculate Geometry
                    </button>
                </div>
            </div>

            {/* Results Panel */}
            <div className="space-y-6">
                {curveResult && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                            Horizontal Curve
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <ResultCard label="Radius" value={`${curveResult.radius} m`} />
                            <ResultCard label="Superelevation" value={`${curveResult.superelevation}%`} />
                            <ResultCard label="Transition Length" value={`${curveResult.transitionLength} m`} />
                            <ResultCard label="Stopping Sight Dist." value={`${curveResult.sightDistance} m`} />
                            <ResultCard label="Widening" value={`${curveResult.widenedWidth} m`} />
                        </div>
                    </div>
                )}

                {verticalResult && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className={`w-2 h-6 rounded-full ${verticalResult.type === 'crest' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            Vertical {verticalResult.type === 'crest' ? 'Crest' : 'Sag'} Curve
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <ResultCard label="Curve Length" value={`${verticalResult.L} m`} />
                            <ResultCard label="K Value" value={`${verticalResult.K}`} />
                            <ResultCard label="Algebraic Diff" value={`${verticalResult.A.toFixed(2)}%`} />
                            <ResultCard label="Sight Distance" value={`${verticalResult.sightDistance.toFixed(1)} m`} />
                        </div>
                    </div>
                )}

                {/* Export Action */}
                {(curveResult || verticalResult) && (
                    <button type="button"
                        onClick={() => {
                            generateCivilReport(
                                "Highway Geometric Design Report",
                                {
                                    "Road Class": params.roadClass,
                                    "Terrain": params.terrain,
                                    "Design Speed": `${params.speed} km/h`,
                                    "Deflection Angle": `${params.deflectionAngle}°`,
                                    "Grade 1": `${params.grade1}%`,
                                    "Grade 2": `${params.grade2}%`
                                },
                                {
                                    ...(curveResult ? {
                                        "Horizontal Radius": `${curveResult.radius} m`,
                                        "Superelevation": `${curveResult.superelevation}%`,
                                        "Transition Length": `${curveResult.transitionLength} m`
                                    } : {}),
                                    ...(verticalResult ? {
                                        "Vertical Curve Type": verticalResult.type,
                                        "Vertical Curve Length": `${verticalResult.L} m`,
                                        "K Value": verticalResult.K
                                    } : {})
                                }
                            );
                        }}
                        className="w-full py-2 bg-[#131b2e] text-[#dae2fd] rounded-lg text-sm font-medium tracking-wide tracking-wide hover:bg-slate-200 dark:hover:bg-slate-900"
                    >
                        📄 Export Design Report
                    </button>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// PAVEMENT DESIGN PANEL
// =============================================================================

function PavementDesignPanel() {
    const [params, setParams] = useState({
        type: 'flexible' as PavementType,
        cbr: 5, // %
        designLife: 15, // years
        traffic: {
            aadt: 2000,
            growthRate: 5, // %
            trucks: 15, // %
        }
    });

    const [result, setResult] = useState<any>(null);

    const calculate = () => {
        const res = transportation.designPavement({
            ADT: params.traffic.aadt, // Not used directly in MSA formula logic in service but part of input
            AADT: params.traffic.aadt,
            peakHourFactor: 0.1, // Default
            growthRate: params.traffic.growthRate,
            truckPercentage: params.traffic.trucks,
            designPeriod: params.designLife,
        }, params.cbr, params.type);

        setResult(res);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Pavement Parameters</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium tracking-wide tracking-wide text-slate-700 mb-1">Pavement Type</label>
                        <div className="flex gap-2">
                            <button type="button"
                                onClick={() => setParams({ ...params, type: 'flexible' })}
                                className={`flex-1 py-2 text-sm rounded-lg border ${params.type === 'flexible' ? 'bg-[#131b2e] text-[#dae2fd] border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                            >
                                Flexible (Bitumen)
                            </button>
                            <button type="button"
                                onClick={() => setParams({ ...params, type: 'rigid' })}
                                className={`flex-1 py-2 text-sm rounded-lg border ${params.type === 'rigid' ? 'bg-[#131b2e] text-[#dae2fd] border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                            >
                                Rigid (Concrete)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Subgrade CBR (%)</label>
                            <input
                                type="number"
                                value={params.cbr}
                                onChange={e => setParams({ ...params, cbr: Number(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Design Life (Years)</label>
                            <input
                                type="number"
                                value={params.designLife}
                                onChange={e => setParams({ ...params, designLife: Number(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900">Traffic Data</h4>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Initial Traffic (AADT)</label>
                            <input
                                type="number"
                                value={params.traffic.aadt}
                                onChange={e => setParams({ ...params, traffic: { ...params.traffic, aadt: Number(e.target.value) } })}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Growth Rate (%)</label>
                                <input
                                    type="number"
                                    value={params.traffic.growthRate}
                                    onChange={e => setParams({ ...params, traffic: { ...params.traffic, growthRate: Number(e.target.value) } })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Heavy Vehicles (%)</label>
                                <input
                                    type="number"
                                    value={params.traffic.trucks}
                                    onChange={e => setParams({ ...params, traffic: { ...params.traffic, trucks: Number(e.target.value) } })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    <button type="button"
                        onClick={calculate}
                        className="w-full py-2.5 bg-[#0b1326] text-white rounded-lg font-semibold hover:bg-black shadow-sm"
                    >
                        Design Pavement Section
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {result && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Design Output</h3>
                                <p className="text-sm text-slate-500">Design Traffic: {result.trafficMSA.toFixed(2)} MSA</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-slate-900">{result.totalThickness} mm</div>
                                <div className="text-xs text-slate-500">Total Thickness</div>
                            </div>
                        </div>

                        {/* Visual Layer Stack */}
                        <div className="border rounded-lg overflow-hidden">
                            {result.layers.map((layer: any, idx: number) => {
                                // Calculate relative height for visualization (min 30px)
                                const height = Math.max(30, (layer.thickness / result.totalThickness) * 300);
                                const colors = [
                                    'bg-[#131b2e]', // Surface
                                    'bg-slate-600', // Base
                                    'bg-yellow-100', // Sub-base
                                ];
                                // Simple color cycling
                                const color = layer.material.includes('BC') || layer.material.includes('PQC') ? 'bg-[#131b2e] text-[#dae2fd]' :
                                    layer.material.includes('DBM') || layer.material.includes('DLC') ? 'bg-slate-600 text-white' :
                                        layer.material.includes('WMM') ? 'bg-slate-400 text-white' :
                                            'bg-amber-100 text-amber-900';

                                return (
                                    <div
                                        key={idx}
                                        className={`${color} w-full flex items-center justify-between px-4 transition-all hover:opacity-90`}
                                        style={{ height: `${height}px` }}
                                    >
                                        <span className="font-medium tracking-wide tracking-wide text-sm">{layer.name}</span>
                                        <span className="text-sm font-mono">{layer.thickness} mm</span>
                                    </div>
                                );
                            })}
                            <div className="bg-orange-100 h-12 flex items-center px-4 text-orange-800 text-sm font-medium tracking-wide tracking-wide border-t border-orange-200">
                                Subgrade (CBR {params.cbr}%)
                            </div>
                        </div>

                        <div className="mt-6 space-y-2">
                            <h4 className="text-sm font-semibold">Layer Details</h4>
                            {result.layers.map((layer: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0 border-slate-100">
                                    <span className="text-slate-600">{layer.name}</span>
                                    <span className="font-medium tracking-wide tracking-wide">{layer.material} ({layer.thickness} mm)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// INTERSECTION ANALYSIS PANEL
// =============================================================================

function IntersectionAnalysisPanel() {
    const [approaches, setApproaches] = useState([
        { volume: 800, lanes: 2, greenTime: 40 }, // North
        { volume: 600, lanes: 2, greenTime: 30 }, // South
        { volume: 400, lanes: 1, greenTime: 20 }, // East
        { volume: 450, lanes: 1, greenTime: 20 }, // West
    ]);

    const [cycleTime, setCycleTime] = useState(120);
    const [result, setResult] = useState<any>(null);

    const updateApproach = (idx: number, field: string, value: number) => {
        const newApps = [...approaches];
        newApps[idx] = { ...newApps[idx], [field]: value };
        setApproaches(newApps);
    };

    const calculate = () => {
        const res = transportation.analyzeSignalizedIntersection(approaches, cycleTime);
        setResult(res);
    };

    const directions = ['Northbound', 'Southbound', 'Eastbound', 'Westbound'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Signal Timing</h3>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Cycle Time (s)</label>
                        <input
                            type="number"
                            value={cycleTime}
                            onChange={e => setCycleTime(Number(e.target.value))}
                            className="w-20 px-2 py-1 border rounded text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    {approaches.map((app, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">{directions[idx]}</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase">Volume (vph)</label>
                                    <input
                                        type="number"
                                        value={app.volume}
                                        onChange={e => updateApproach(idx, 'volume', Number(e.target.value))}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase">Lanes</label>
                                    <input
                                        type="number"
                                        value={app.lanes}
                                        onChange={e => updateApproach(idx, 'lanes', Number(e.target.value))}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase">Green (s)</label>
                                    <input
                                        type="number"
                                        value={app.greenTime}
                                        onChange={e => updateApproach(idx, 'greenTime', Number(e.target.value))}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    <button type="button"
                        onClick={calculate}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-sm"
                    >
                        Analyze Intersection
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {result && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
                        <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl font-bold mb-4 ${result.los === 'A' ? 'bg-green-100 text-green-700' :
                            result.los === 'B' ? 'bg-green-50 text-green-600' :
                                result.los === 'C' ? 'bg-yellow-50 text-yellow-600' :
                                    result.los === 'D' ? 'bg-orange-50 text-orange-600' :
                                        result.los === 'E' ? 'bg-orange-100 text-orange-700' :
                                            'bg-red-100 text-red-700'
                            }`}>
                            {result.los}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">Level of Service {result.los}</h3>
                        <p className="text-slate-500 text-sm mb-6">Average Delay: {result.delay.toFixed(1)} sec/veh</p>

                        <div className="grid grid-cols-2 gap-4 text-left">
                            <ResultCard label="Total Capacity" value={`${Math.round(result.capacity)} veh/hr`} />
                            <ResultCard label="Queue Length (Approx)" value={`${result.queueLength.toFixed(1)} m`} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ResultCard({ label, value }: { label: string, value: string }) {
    return (
        <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="text-lg font-bold text-slate-900">{value}</div>
        </div>
    );
}
