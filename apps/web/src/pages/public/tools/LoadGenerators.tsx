/**
 * LoadGenerators - IS 875 Wind & IS 1893 Seismic Calculators
 * 
 * Standalone calculators for Indian Standard design loads.
 * Shows full calculation steps for transparency.
 */

import { FC, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, Wind, Activity, Copy, Check, ChevronDown,
    ArrowRight, Info, Calculator, MapPin
} from 'lucide-react';

// ============================================
// IS 875 WIND DATA
// ============================================

interface City {
    name: string;
    state: string;
    Vb: number;  // Basic wind speed (m/s)
}

const CITIES: City[] = [
    { name: 'Mumbai', state: 'Maharashtra', Vb: 44 },
    { name: 'Delhi', state: 'Delhi', Vb: 47 },
    { name: 'Chennai', state: 'Tamil Nadu', Vb: 50 },
    { name: 'Kolkata', state: 'West Bengal', Vb: 50 },
    { name: 'Bangalore', state: 'Karnataka', Vb: 33 },
    { name: 'Hyderabad', state: 'Telangana', Vb: 44 },
    { name: 'Ahmedabad', state: 'Gujarat', Vb: 39 },
    { name: 'Pune', state: 'Maharashtra', Vb: 39 },
    { name: 'Jaipur', state: 'Rajasthan', Vb: 47 },
    { name: 'Lucknow', state: 'Uttar Pradesh', Vb: 47 },
    { name: 'Bhopal', state: 'Madhya Pradesh', Vb: 39 },
    { name: 'Chandigarh', state: 'Punjab', Vb: 47 },
    { name: 'Guwahati', state: 'Assam', Vb: 50 },
    { name: 'Visakhapatnam', state: 'Andhra Pradesh', Vb: 50 },
    { name: 'Thiruvananthapuram', state: 'Kerala', Vb: 39 }
];

const TERRAIN_CATEGORIES = [
    { id: 1, name: 'Category 1', description: 'Exposed open terrain with few obstructions', k2_base: 1.05 },
    { id: 2, name: 'Category 2', description: 'Open terrain with scattered obstructions (industrial areas)', k2_base: 1.00 },
    { id: 3, name: 'Category 3', description: 'Terrain with numerous closely spaced obstructions (suburban)', k2_base: 0.91 },
    { id: 4, name: 'Category 4', description: 'Terrain with numerous large high closely spaced obstructions (city centers)', k2_base: 0.80 }
];

// k2 values for different heights (Table 2, IS 875 Part 3)
const K2_TABLE: Record<number, number[]> = {
    // height: [cat1, cat2, cat3, cat4]
    10: [1.05, 1.00, 0.91, 0.80],
    15: [1.09, 1.05, 0.97, 0.80],
    20: [1.12, 1.07, 1.01, 0.80],
    30: [1.15, 1.12, 1.06, 0.97],
    50: [1.20, 1.17, 1.12, 1.10],
    100: [1.26, 1.24, 1.20, 1.20],
    150: [1.30, 1.28, 1.24, 1.24]
};

function getK2(height: number, category: number): number {
    const heights = Object.keys(K2_TABLE).map(Number).sort((a, b) => a - b);

    // Find interpolation bounds
    let lower = heights[0];
    let upper = heights[heights.length - 1];

    for (let i = 0; i < heights.length - 1; i++) {
        if (height >= heights[i] && height <= heights[i + 1]) {
            lower = heights[i];
            upper = heights[i + 1];
            break;
        }
    }

    if (height <= lower) return K2_TABLE[lower][category - 1];
    if (height >= upper) return K2_TABLE[upper][category - 1];

    // Linear interpolation
    const ratio = (height - lower) / (upper - lower);
    const k2Lower = K2_TABLE[lower][category - 1];
    const k2Upper = K2_TABLE[upper][category - 1];

    return k2Lower + ratio * (k2Upper - k2Lower);
}

// ============================================
// IS 1893 SEISMIC DATA
// ============================================

const SEISMIC_ZONES = [
    { id: 'II', name: 'Zone II', Z: 0.10, description: 'Low damage risk zone' },
    { id: 'III', name: 'Zone III', Z: 0.16, description: 'Moderate damage risk zone' },
    { id: 'IV', name: 'Zone IV', Z: 0.24, description: 'High damage risk zone' },
    { id: 'V', name: 'Zone V', Z: 0.36, description: 'Very high damage risk zone' }
];

const SOIL_TYPES = [
    { id: 'I', name: 'Type I (Rock/Hard)', Sa_g: 2.5 },
    { id: 'II', name: 'Type II (Medium)', Sa_g: 2.5 },
    { id: 'III', name: 'Type III (Soft)', Sa_g: 2.5 }
];

const IMPORTANCE_FACTORS = [
    { id: '1.0', name: 'Normal (I = 1.0)', I: 1.0 },
    { id: '1.2', name: 'Important (I = 1.2)', I: 1.2 },
    { id: '1.5', name: 'Critical (I = 1.5)', I: 1.5 }
];

const RESPONSE_REDUCTION = [
    { id: '3', name: 'OMRF (R = 3)', R: 3 },
    { id: '4', name: 'IMRF (R = 4)', R: 4 },
    { id: '5', name: 'SMRF (R = 5)', R: 5 }
];

// ============================================
// COPY BUTTON COMPONENT
// ============================================

interface CopyButtonProps {
    value: string;
    label?: string;
}

const CopyButton: FC<CopyButtonProps> = ({ value, label = 'Copy' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
        >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : label}
        </button>
    );
};

// ============================================
// WIND CALCULATOR
// ============================================

const WindCalculator: FC = () => {
    const [selectedCity, setSelectedCity] = useState<City>(CITIES[0]);
    const [terrainCategory, setTerrainCategory] = useState(2);
    const [height, setHeight] = useState(15);
    const [k1, setK1] = useState(1.0);  // Risk coefficient
    const [k3, setK3] = useState(1.0);  // Topography factor

    const calculations = useMemo(() => {
        const Vb = selectedCity.Vb;
        const k2 = getK2(height, terrainCategory);
        const Vz = Vb * k1 * k2 * k3;
        const Pz = 0.6 * Vz * Vz / 1000;  // kN/m²

        return { Vb, k1, k2, k3, Vz, Pz };
    }, [selectedCity, terrainCategory, height, k1, k3]);

    return (
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Wind className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">IS 875 Wind Load</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Part 3 - Design Wind Pressure</p>
                </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* City */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        City
                    </label>
                    <select
                        value={selectedCity.name}
                        onChange={(e) => setSelectedCity(CITIES.find(c => c.name === e.target.value) || CITIES[0])}
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        {CITIES.map(city => (
                            <option key={city.name} value={city.name}>
                                {city.name} ({city.state}) - Vb = {city.Vb} m/s
                            </option>
                        ))}
                    </select>
                </div>

                {/* Terrain */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">Terrain Category</label>
                    <select
                        value={terrainCategory}
                        onChange={(e) => setTerrainCategory(parseInt(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        {TERRAIN_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                        {TERRAIN_CATEGORIES.find(c => c.id === terrainCategory)?.description}
                    </p>
                </div>

                {/* Height */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">Building Height (m)</label>
                    <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(parseFloat(e.target.value) || 10)}
                        min="5"
                        max="200"
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* k1 */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">k₁ (Risk Coefficient)</label>
                    <select
                        value={k1}
                        onChange={(e) => setK1(parseFloat(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="0.82">0.82 - Agricultural</option>
                        <option value="0.90">0.90 - Industrial</option>
                        <option value="1.00">1.00 - Normal (50 yr life)</option>
                        <option value="1.05">1.05 - Important</option>
                        <option value="1.08">1.08 - Critical</option>
                    </select>
                </div>
            </div>

            {/* Calculation Steps */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 mb-6 font-mono text-sm">
                <div className="text-slate-500 dark:text-slate-400 mb-3">Calculation as per IS 875 (Part 3):</div>
                <div className="space-y-2 text-slate-600 dark:text-slate-300">
                    <div>Vb = <span className="text-blue-400">{calculations.Vb}</span> m/s (Basic wind speed)</div>
                    <div>k₁ = <span className="text-blue-400">{calculations.k1.toFixed(2)}</span> (Risk coefficient)</div>
                    <div>k₂ = <span className="text-blue-400">{calculations.k2.toFixed(3)}</span> (Terrain & height factor at {height}m)</div>
                    <div>k₃ = <span className="text-blue-400">{calculations.k3.toFixed(2)}</span> (Topography factor)</div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                        Vz = Vb × k₁ × k₂ × k₃
                    </div>
                    <div>
                        Vz = {calculations.Vb} × {calculations.k1} × {calculations.k2.toFixed(3)} × {calculations.k3}
                    </div>
                    <div className="text-green-400 font-bold">
                        Vz = {calculations.Vz.toFixed(2)} m/s
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                        Pz = 0.6 × Vz²
                    </div>
                    <div className="text-green-400 font-bold text-lg">
                        Pz = {calculations.Pz.toFixed(3)} kN/m²
                    </div>
                </div>
            </div>

            {/* Result */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-900/50 to-blue-800/30 rounded-xl p-4">
                <div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm">Design Wind Pressure</div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                        {calculations.Pz.toFixed(3)} <span className="text-lg font-normal text-slate-600 dark:text-slate-300">kN/m²</span>
                    </div>
                </div>
                <CopyButton value={calculations.Pz.toFixed(3)} label="Copy Pz" />
            </div>
        </div>
    );
};

// ============================================
// SEISMIC CALCULATOR
// ============================================

const SeismicCalculator: FC = () => {
    const [zone, setZone] = useState(SEISMIC_ZONES[1]);
    const [soilType, setSoilType] = useState(SOIL_TYPES[1]);
    const [importance, setImportance] = useState(IMPORTANCE_FACTORS[0]);
    const [responseR, setResponseR] = useState(RESPONSE_REDUCTION[2]);
    const [period, setPeriod] = useState(0.5);

    const calculations = useMemo(() => {
        const Z = zone.Z;
        const I = importance.I;
        const R = responseR.R;

        // Sa/g based on period and soil type (simplified)
        let Sa_g: number;
        if (period < 0.1) {
            Sa_g = 1 + 15 * period;
        } else if (period < 0.55) {
            Sa_g = 2.5;
        } else if (period < 4.0) {
            Sa_g = 1.36 / period;
        } else {
            Sa_g = 0.34;
        }

        // Adjust for soil type
        if (soilType.id === 'III' && period > 0.67) {
            Sa_g = 1.67 / period;
        }

        const Ah = (Z / 2) * (I / R) * Sa_g;

        return { Z, I, R, Sa_g, Ah };
    }, [zone, importance, responseR, period, soilType]);

    return (
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">IS 1893 Seismic Load</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Part 1 - Horizontal Seismic Coefficient</p>
                </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Zone */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">Seismic Zone</label>
                    <select
                        value={zone.id}
                        onChange={(e) => setZone(SEISMIC_ZONES.find(z => z.id === e.target.value) || SEISMIC_ZONES[0])}
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                        {SEISMIC_ZONES.map(z => (
                            <option key={z.id} value={z.id}>
                                {z.name} (Z = {z.Z})
                            </option>
                        ))}
                    </select>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{zone.description}</p>
                </div>

                {/* Soil Type */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">Soil Type</label>
                    <select
                        value={soilType.id}
                        onChange={(e) => setSoilType(SOIL_TYPES.find(s => s.id === e.target.value) || SOIL_TYPES[0])}
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                        {SOIL_TYPES.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                {/* Importance Factor */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">Importance Factor</label>
                    <select
                        value={importance.id}
                        onChange={(e) => setImportance(IMPORTANCE_FACTORS.find(i => i.id === e.target.value) || IMPORTANCE_FACTORS[0])}
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                        {IMPORTANCE_FACTORS.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                    </select>
                </div>

                {/* Response Reduction */}
                <div>
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">Response Reduction (R)</label>
                    <select
                        value={responseR.id}
                        onChange={(e) => setResponseR(RESPONSE_REDUCTION.find(r => r.id === e.target.value) || RESPONSE_REDUCTION[0])}
                        className="w-full px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                        {RESPONSE_REDUCTION.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                {/* Natural Period */}
                <div className="md:col-span-2">
                    <label className="text-slate-600 dark:text-slate-300 text-sm block mb-2">Natural Period T (seconds)</label>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            value={period}
                            onChange={(e) => setPeriod(parseFloat(e.target.value))}
                            min="0.1"
                            max="4"
                            step="0.05"
                            className="flex-1"
                        />
                        <input
                            type="number"
                            value={period}
                            onChange={(e) => setPeriod(parseFloat(e.target.value) || 0.5)}
                            step="0.1"
                            className="w-24 px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-zinc-900 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Calculation Steps */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 mb-6 font-mono text-sm">
                <div className="text-slate-500 dark:text-slate-400 mb-3">Calculation as per IS 1893 (Part 1):</div>
                <div className="space-y-2 text-slate-600 dark:text-slate-300">
                    <div>Z = <span className="text-red-400">{calculations.Z}</span> (Zone factor)</div>
                    <div>I = <span className="text-red-400">{calculations.I}</span> (Importance factor)</div>
                    <div>R = <span className="text-red-400">{calculations.R}</span> (Response reduction)</div>
                    <div>Sa/g = <span className="text-red-400">{calculations.Sa_g.toFixed(3)}</span> (Spectral acceleration at T = {period}s)</div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                        Ah = (Z/2) × (I/R) × (Sa/g)
                    </div>
                    <div>
                        Ah = ({calculations.Z}/2) × ({calculations.I}/{calculations.R}) × {calculations.Sa_g.toFixed(3)}
                    </div>
                    <div className="text-red-400 font-bold text-lg">
                        Ah = {calculations.Ah.toFixed(4)}
                    </div>
                </div>
            </div>

            {/* Result */}
            <div className="flex items-center justify-between bg-gradient-to-r from-red-900/50 to-red-800/30 rounded-xl p-4">
                <div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm">Horizontal Seismic Coefficient</div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                        {calculations.Ah.toFixed(4)} <span className="text-lg font-normal text-slate-600 dark:text-slate-300">Ah</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Base Shear = {(calculations.Ah * 100).toFixed(2)}% of Seismic Weight
                    </div>
                </div>
                <CopyButton value={calculations.Ah.toFixed(4)} label="Copy Ah" />
            </div>
        </div>
    );
};

// ============================================
// MAIN PAGE
// ============================================

export const LoadGenerators: FC = () => {
    const [activeTab, setActiveTab] = useState<'wind' | 'seismic'>('wind');

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 dark:from-slate-900 to-white dark:to-slate-950">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-white font-bold">BeamLab</span>
                        </Link>
                        <span className="text-slate-500">/</span>
                        <Link to="/tools" className="text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white text-sm">Tools</Link>
                        <span className="text-slate-500">/</span>
                        <span className="text-zinc-900 dark:text-white text-sm font-medium">Load Generators</span>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8">
                {/* Title */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Indian Standard Load Calculators</h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                        Calculate design wind pressure (IS 875) and seismic coefficients (IS 1893)
                        with full transparency on the calculation steps.
                    </p>
                </div>

                {/* Tab Switcher */}
                <div className="flex justify-center gap-2 mb-8">
                    <button
                        onClick={() => setActiveTab('wind')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'wind'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <Wind className="w-5 h-5" />
                        Wind Load (IS 875)
                    </button>
                    <button
                        onClick={() => setActiveTab('seismic')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'seismic'
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <Activity className="w-5 h-5" />
                        Seismic Load (IS 1893)
                    </button>
                </div>

                {/* Calculator */}
                {activeTab === 'wind' ? <WindCalculator /> : <SeismicCalculator />}

                {/* Info Box */}
                <div className="mt-8 bg-slate-100/30 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        <strong className="text-zinc-900 dark:text-white">Note:</strong> These calculators provide quick estimates
                        based on IS 875 (Part 3) and IS 1893 (Part 1). For detailed design, consider additional
                        factors like building shape, openings, and site-specific conditions. Always verify with
                        the latest code provisions.
                    </div>
                </div>

                {/* CTA */}
                <div className="mt-12 text-center">
                    <Link
                        to="/demo"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-semibold transition-all"
                    >
                        <Calculator className="w-5 h-5" />
                        Apply Loads in 3D Model
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default LoadGenerators;
