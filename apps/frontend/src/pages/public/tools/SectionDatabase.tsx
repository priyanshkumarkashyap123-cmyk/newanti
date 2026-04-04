/**
 * SectionDatabase - Searchable Steel Section Library
 * 
 * Browse and search AISC/IS steel sections with interactive cross-section visualization.
 * No authentication required - public SEO page.
 */

import { FC, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Zap, Filter, Download, ArrowRight, Layers, X } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface SteelSection {
    name: string;
    type: 'W' | 'I' | 'C' | 'L' | 'HSS' | 'ISMB' | 'ISMC' | 'ISA';
    d: number;      // Depth (mm)
    bf: number;     // Flange width (mm)
    tf: number;     // Flange thickness (mm)
    tw: number;     // Web thickness (mm)
    A: number;      // Area (cm²)
    Ix: number;     // Moment of inertia X (cm⁴)
    Iy: number;     // Moment of inertia Y (cm⁴)
    Zx: number;     // Section modulus X (cm³)
    Zy: number;     // Section modulus Y (cm³)
    rx: number;     // Radius of gyration X (cm)
    ry: number;     // Radius of gyration Y (cm)
    weight: number; // kg/m
}

type HighlightPart = 'flange' | 'web' | 'd' | 'bf' | 'tf' | 'tw' | null;

// ============================================
// SAMPLE DATA (Subset - full data from JSON files)
// ============================================

const SECTIONS: SteelSection[] = [
    // AISC W Shapes
    { name: 'W14x90', type: 'W', d: 355.6, bf: 368.3, tf: 18, tw: 11.2, A: 171, Ix: 41600, Iy: 15100, Zx: 2340, Zy: 820, rx: 15.6, ry: 9.4, weight: 134 },
    { name: 'W14x68', type: 'W', d: 355.6, bf: 254, tf: 18.3, tw: 10.5, A: 129, Ix: 30100, Iy: 4030, Zx: 1690, Zy: 317, rx: 15.3, ry: 5.6, weight: 101 },
    { name: 'W12x87', type: 'W', d: 317.5, bf: 307.3, tf: 20.8, tw: 13.1, A: 165, Ix: 29900, Iy: 9840, Zx: 1880, Zy: 640, rx: 13.5, ry: 7.7, weight: 129 },
    { name: 'W12x58', type: 'W', d: 309.6, bf: 254, tf: 16.3, tw: 9.1, A: 110, Ix: 19500, Iy: 3470, Zx: 1260, Zy: 274, rx: 13.3, ry: 5.6, weight: 86 },
    { name: 'W10x49', type: 'W', d: 254, bf: 254, tf: 14.2, tw: 8.8, A: 93, Ix: 11300, Iy: 3470, Zx: 890, Zy: 274, rx: 11, ry: 6.1, weight: 73 },
    { name: 'W8x31', type: 'W', d: 203.2, bf: 203.2, tf: 11.1, tw: 7.2, A: 59, Ix: 4920, Iy: 1590, Zx: 484, Zy: 157, rx: 9.1, ry: 5.2, weight: 46 },
    { name: 'W6x25', type: 'W', d: 162.1, bf: 154.4, tf: 11.6, tw: 8.1, A: 48, Ix: 2190, Iy: 604, Zx: 270, Zy: 78, rx: 6.8, ry: 3.6, weight: 37 },

    // Indian Standard Sections
    { name: 'ISMB 600', type: 'ISMB', d: 600, bf: 210, tf: 20.8, tw: 12, A: 156.2, Ix: 91800, Iy: 3060, Zx: 3060, Zy: 291, rx: 24.2, ry: 4.4, weight: 122.6 },
    { name: 'ISMB 500', type: 'ISMB', d: 500, bf: 180, tf: 17.2, tw: 10.2, A: 110.7, Ix: 45200, Iy: 1370, Zx: 1810, Zy: 152, rx: 20.2, ry: 3.5, weight: 86.9 },
    { name: 'ISMB 450', type: 'ISMB', d: 450, bf: 150, tf: 17.4, tw: 9.4, A: 92.27, Ix: 30400, Iy: 834, Zx: 1350, Zy: 111, rx: 18.1, ry: 3, weight: 72.4 },
    { name: 'ISMB 400', type: 'ISMB', d: 400, bf: 140, tf: 16, tw: 8.9, A: 78.46, Ix: 20500, Iy: 622, Zx: 1020, Zy: 89, rx: 16.2, ry: 2.8, weight: 61.6 },
    { name: 'ISMB 350', type: 'ISMB', d: 350, bf: 140, tf: 14.2, tw: 8.1, A: 66.71, Ix: 13600, Iy: 538, Zx: 779, Zy: 77, rx: 14.3, ry: 2.8, weight: 52.4 },
    { name: 'ISMB 300', type: 'ISMB', d: 300, bf: 140, tf: 12.4, tw: 7.5, A: 56.26, Ix: 8600, Iy: 454, Zx: 573, Zy: 65, rx: 12.4, ry: 2.8, weight: 44.2 },
    { name: 'ISMB 250', type: 'ISMB', d: 250, bf: 125, tf: 12.5, tw: 6.9, A: 47.55, Ix: 5130, Iy: 335, Zx: 410, Zy: 54, rx: 10.4, ry: 2.7, weight: 37.3 },
    { name: 'ISMB 200', type: 'ISMB', d: 200, bf: 100, tf: 10.8, tw: 5.7, A: 32.33, Ix: 2240, Iy: 150, Zx: 224, Zy: 30, rx: 8.3, ry: 2.2, weight: 25.4 },

    // IS Channels
    { name: 'ISMC 400', type: 'ISMC', d: 400, bf: 100, tf: 15.3, tw: 8.6, A: 63.8, Ix: 15200, Iy: 508, Zx: 761, Zy: 67, rx: 15.4, ry: 2.8, weight: 50.1 },
    { name: 'ISMC 300', type: 'ISMC', d: 300, bf: 90, tf: 13.6, tw: 7.8, A: 46.3, Ix: 6420, Iy: 313, Zx: 428, Zy: 46, rx: 11.8, ry: 2.6, weight: 36.3 },
    { name: 'ISMC 200', type: 'ISMC', d: 200, bf: 75, tf: 11.4, tw: 6.1, A: 28.2, Ix: 1830, Iy: 141, Zx: 183, Zy: 25, rx: 8.1, ry: 2.2, weight: 22.1 },
];

const SECTION_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'W', label: 'W Shapes (AISC)' },
    { value: 'ISMB', label: 'ISMB (Indian)' },
    { value: 'ISMC', label: 'ISMC Channels' }
];

// ============================================
// SVG CROSS-SECTION COMPONENT
// ============================================

interface CrossSectionProps {
    section: SteelSection;
    highlightPart: HighlightPart;
    onHoverPart: (part: HighlightPart) => void;
}

const CrossSectionSVG: FC<CrossSectionProps> = ({ section, highlightPart, onHoverPart }) => {
    const { d, bf, tf, tw, type } = section;

    const width = 200;
    const height = 200;
    const padding = 20;

    // Scale to fit
    const scale = Math.min((width - 2 * padding) / bf, (height - 2 * padding) / d);
    const scaledD = d * scale;
    const scaledBf = bf * scale;
    const scaledTf = tf * scale;
    const scaledTw = tw * scale;

    const centerX = width / 2;
    const centerY = height / 2;

    // Colors
    const baseColor = '#3B82F6';
    const highlightColor = '#FBBF24';

    const flangeColor = highlightPart === 'flange' || highlightPart === 'tf' || highlightPart === 'bf'
        ? highlightColor : baseColor;
    const webColor = highlightPart === 'web' || highlightPart === 'tw'
        ? highlightColor : baseColor;

    // I-beam / W-shape rendering
    if (type === 'W' || type === 'I' || type === 'ISMB') {
        return (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
                {/* Background */}
                <rect width={width} height={height} fill="#1E293B" rx="8" />

                {/* Top Flange */}
                <rect
                    x={centerX - scaledBf / 2}
                    y={centerY - scaledD / 2}
                    width={scaledBf}
                    height={scaledTf}
                    fill={flangeColor}
                    stroke="#1E3A8A"
                    strokeWidth="1"
                    className="cursor-pointer transition-colors"
                    onMouseEnter={() => onHoverPart('flange')}
                    onMouseLeave={() => onHoverPart(null)}
                />

                {/* Web */}
                <rect
                    x={centerX - scaledTw / 2}
                    y={centerY - scaledD / 2 + scaledTf}
                    width={scaledTw}
                    height={scaledD - 2 * scaledTf}
                    fill={webColor}
                    stroke="#1E3A8A"
                    strokeWidth="1"
                    className="cursor-pointer transition-colors"
                    onMouseEnter={() => onHoverPart('web')}
                    onMouseLeave={() => onHoverPart(null)}
                />

                {/* Bottom Flange */}
                <rect
                    x={centerX - scaledBf / 2}
                    y={centerY + scaledD / 2 - scaledTf}
                    width={scaledBf}
                    height={scaledTf}
                    fill={flangeColor}
                    stroke="#1E3A8A"
                    strokeWidth="1"
                    className="cursor-pointer transition-colors"
                    onMouseEnter={() => onHoverPart('flange')}
                    onMouseLeave={() => onHoverPart(null)}
                />

                {/* Dimension lines */}
                {/* Depth (d) */}
                <line x1={centerX + scaledBf / 2 + 15} y1={centerY - scaledD / 2}
                    x2={centerX + scaledBf / 2 + 15} y2={centerY + scaledD / 2}
                    stroke="#94A3B8" strokeWidth="1" />
                <text x={centerX + scaledBf / 2 + 25} y={centerY}
                    fill={highlightPart === 'd' ? highlightColor : '#94A3B8'}
                    fontSize="10" textAnchor="start" dominantBaseline="middle">d</text>

                {/* Flange width (bf) */}
                <line x1={centerX - scaledBf / 2} y1={centerY - scaledD / 2 - 10}
                    x2={centerX + scaledBf / 2} y2={centerY - scaledD / 2 - 10}
                    stroke="#94A3B8" strokeWidth="1" />
                <text x={centerX} y={centerY - scaledD / 2 - 15}
                    fill={highlightPart === 'bf' ? highlightColor : '#94A3B8'}
                    fontSize="10" textAnchor="middle">bf</text>
            </svg>
        );
    }

    // Channel rendering
    if (type === 'C' || type === 'ISMC') {
        return (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
                <rect width={width} height={height} fill="#1E293B" rx="8" />

                {/* Top Flange */}
                <rect
                    x={centerX - scaledBf / 3}
                    y={centerY - scaledD / 2}
                    width={scaledBf}
                    height={scaledTf}
                    fill={flangeColor}
                    stroke="#1E3A8A"
                    strokeWidth="1"
                    className="cursor-pointer"
                    onMouseEnter={() => onHoverPart('flange')}
                    onMouseLeave={() => onHoverPart(null)}
                />

                {/* Web */}
                <rect
                    x={centerX - scaledBf / 3}
                    y={centerY - scaledD / 2}
                    width={scaledTw}
                    height={scaledD}
                    fill={webColor}
                    stroke="#1E3A8A"
                    strokeWidth="1"
                    className="cursor-pointer"
                    onMouseEnter={() => onHoverPart('web')}
                    onMouseLeave={() => onHoverPart(null)}
                />

                {/* Bottom Flange */}
                <rect
                    x={centerX - scaledBf / 3}
                    y={centerY + scaledD / 2 - scaledTf}
                    width={scaledBf}
                    height={scaledTf}
                    fill={flangeColor}
                    stroke="#1E3A8A"
                    strokeWidth="1"
                    className="cursor-pointer"
                    onMouseEnter={() => onHoverPart('flange')}
                    onMouseLeave={() => onHoverPart(null)}
                />
            </svg>
        );
    }

    // Default
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
            <rect width={width} height={height} fill="#1E293B" rx="8" />
            <text x={centerX} y={centerY} fill="#64748B" textAnchor="middle">
                {type} section
            </text>
        </svg>
    );
};

// ============================================
// PROPERTIES TABLE
// ============================================

interface PropertyRowProps {
    label: string;
    value: string | number;
    unit: string;
    highlighted?: boolean;
    onHover?: () => void;
    onLeave?: () => void;
}

const PropertyRow: FC<PropertyRowProps> = ({ label, value, unit, highlighted, onHover, onLeave }) => (
    <tr
        className={`border-b border-slate-200/50 dark:border-slate-700/50 transition-colors ${highlighted ? 'bg-yellow-500/20' : 'hover:bg-slate-700/30'
            }`}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
    >
        <td className="py-2 px-3 text-[#869ab8] text-sm">{label}</td>
        <td className={`py-2 px-3 text-right font-mono ${highlighted ? 'text-yellow-400 font-bold' : 'text-[#dae2fd]'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
        </td>
        <td className="py-2 px-3 text-[#869ab8] text-sm">{unit}</td>
    </tr>
);

// ============================================
// MAIN PAGE
// ============================================

export const SectionDatabase: FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [selectedSection, setSelectedSection] = useState<SteelSection | null>(SECTIONS[0] ?? null);
    const [highlightPart, setHighlightPart] = useState<HighlightPart>(null);

    // Filter sections
    const filteredSections = useMemo(() => {
        return SECTIONS.filter(section => {
            const matchesSearch = !searchQuery ||
                section.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = !typeFilter || section.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [searchQuery, typeFilter]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 dark:from-slate-900 to-white dark:to-slate-950">
            {/* Header */}
            <header className="border-b border-[#1a2333] bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-white font-bold">BeamLab</span>
                        </Link>
                        <span className="text-slate-500">/</span>
                        <Link to="/tools" className="text-[#869ab8] hover:text-slate-900 dark:hover:text-white text-sm">Tools</Link>
                        <span className="text-slate-500">/</span>
                        <span className="text-[#dae2fd] text-sm font-medium tracking-wide">Section Library</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#dae2fd] mb-2">Steel Section Library</h1>
                    <p className="text-[#869ab8]">
                        Browse AISC W-shapes and IS steel sections. Click a section to view properties and cross-section.
                    </p>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                        <input
                            type="text"
                            placeholder="Search sections... (e.g., W14x90, ISMB 500)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-100/80 dark:bg-slate-800/80 border border-[#1a2333] rounded-xl text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#869ab8] hover:text-slate-900 dark:hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#869ab8]" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="pl-9 pr-8 py-3 bg-[#131b2e] border border-[#1a2333] rounded-xl text-[#dae2fd] appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {SECTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Section List */}
                    <div className="lg:col-span-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4 max-h-[600px] overflow-y-auto">
                        <h3 className="text-[#dae2fd] font-medium tracking-wide mb-3 flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Sections ({filteredSections.length})
                        </h3>
                        <div className="space-y-1">
                            {filteredSections.map(section => (
                                <button type="button"
                                    key={section.name}
                                    onClick={() => setSelectedSection(section)}
                                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedSection?.name === section.name
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                        }`}
                                >
                                    <div className="font-medium tracking-wide">{section.name}</div>
                                    <div className="text-xs opacity-70">{section.weight} kg/m</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section Details */}
                    {selectedSection ? (
                        <div className="lg:col-span-2 space-y-6">
                            {/* Cross-Section Visual */}
                            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
                                <h3 className="text-[#dae2fd] font-semibold text-xl mb-4">
                                    {selectedSection.name}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <CrossSectionSVG
                                        section={selectedSection}
                                        highlightPart={highlightPart}
                                        onHoverPart={setHighlightPart}
                                    />
                                    <div className="text-sm text-[#869ab8]">
                                        <p className="mb-2">
                                            <span className="text-blue-400">Hover</span> over the cross-section
                                            to highlight related properties.
                                        </p>
                                        <div className="flex gap-4 mt-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-blue-500 rounded" />
                                                <span>Flange</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-blue-500 rounded" />
                                                <span>Web</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-yellow-500 rounded" />
                                                <span>Highlighted</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Properties Tables */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Dimensions */}
                                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
                                    <h4 className="text-[#dae2fd] font-medium tracking-wide mb-3">Dimensions</h4>
                                    <table className="w-full">
                                        <tbody>
                                            <PropertyRow
                                                label="Depth (d)"
                                                value={selectedSection.d}
                                                unit="mm"
                                                highlighted={highlightPart === 'd'}
                                                onHover={() => setHighlightPart('d')}
                                                onLeave={() => setHighlightPart(null)}
                                            />
                                            <PropertyRow
                                                label="Flange Width (bf)"
                                                value={selectedSection.bf}
                                                unit="mm"
                                                highlighted={highlightPart === 'bf' || highlightPart === 'flange'}
                                                onHover={() => setHighlightPart('bf')}
                                                onLeave={() => setHighlightPart(null)}
                                            />
                                            <PropertyRow
                                                label="Flange Thickness (tf)"
                                                value={selectedSection.tf}
                                                unit="mm"
                                                highlighted={highlightPart === 'flange'}
                                                onHover={() => setHighlightPart('flange')}
                                                onLeave={() => setHighlightPart(null)}
                                            />
                                            <PropertyRow
                                                label="Web Thickness (tw)"
                                                value={selectedSection.tw}
                                                unit="mm"
                                                highlighted={highlightPart === 'web' || highlightPart === 'tw'}
                                                onHover={() => setHighlightPart('tw')}
                                                onLeave={() => setHighlightPart(null)}
                                            />
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section Properties */}
                                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
                                    <h4 className="text-[#dae2fd] font-medium tracking-wide mb-3">Section Properties</h4>
                                    <table className="w-full">
                                        <tbody>
                                            <PropertyRow label="Area (A)" value={selectedSection.A} unit="cm²" />
                                            <PropertyRow label="Weight" value={selectedSection.weight} unit="kg/m" />
                                            <PropertyRow label="Ix" value={selectedSection.Ix} unit="cm⁴" />
                                            <PropertyRow label="Iy" value={selectedSection.Iy} unit="cm⁴" />
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section Modulus */}
                                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
                                    <h4 className="text-[#dae2fd] font-medium tracking-wide mb-3">Section Modulus</h4>
                                    <table className="w-full">
                                        <tbody>
                                            <PropertyRow label="Zx" value={selectedSection.Zx} unit="cm³" />
                                            <PropertyRow label="Zy" value={selectedSection.Zy} unit="cm³" />
                                            <PropertyRow label="rx" value={selectedSection.rx} unit="cm" />
                                            <PropertyRow label="ry" value={selectedSection.ry} unit="cm" />
                                        </tbody>
                                    </table>
                                </div>

                                {/* Actions */}
                                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4 flex flex-col justify-center">
                                    <button type="button" className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium tracking-wide transition-colors mb-3">
                                        <Download className="w-4 h-4" />
                                        Download Data
                                    </button>
                                    <Link
                                        to="/demo"
                                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-[#dae2fd] rounded-lg transition-colors"
                                    >
                                        Use in 3D Model
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="lg:col-span-2 flex items-center justify-center text-[#869ab8]">
                            Select a section to view details
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SectionDatabase;
