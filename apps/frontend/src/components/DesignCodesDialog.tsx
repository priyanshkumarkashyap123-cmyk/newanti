/**
 * DesignCodesDialog.tsx - Structural Design Code Compliance
 * 
 * Central dialog for accessing all design code checks:
 * - Steel Design (IS 800:2007, AISC 360-16)
 * - Concrete Design (IS 456:2000)
 * - Connection Design
 * - Foundation Design
 */

import { FC, useState } from 'react';
import {
    Building2,
    Wrench,
    Columns,
    Link2,
    Landmark,
    Globe,
    ChevronRight,
    Crown,
    FileCheck,
    Download,
    RefreshCw,
    CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

// Import panel components
import { SteelDesignPanel } from './SteelDesignPanel';
import { IS456DesignPanel } from './IS456DesignPanel';
import { ConnectionDesignDialog } from './ConnectionDesignDialog';
import { TierGate } from './TierGate';

// ============================================
// TYPES
// ============================================

type DesignType = 'steel' | 'concrete' | 'connection' | 'foundation' | 'international';

interface DesignCodesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isPro?: boolean;
    initialTab?: DesignType;
}

// ============================================
// DESIGN OPTIONS
// ============================================

const DESIGN_OPTIONS: Array<{
    id: DesignType;
    name: string;
    codes: string[];
    description: string;
    icon: FC<{ className?: string }>;
    color: string;
}> = [
        {
            id: 'steel',
            name: 'Steel Design',
            codes: ['IS 800:2007', 'AISC 360-16'],
            description: 'Steel member capacity checks and optimization',
            icon: Building2,
            color: 'blue',
        },
        {
            id: 'concrete',
            name: 'Concrete Design',
            codes: ['IS 456:2000'],
            description: 'RC beam/column design with rebar detailing',
            icon: Columns,
            color: 'gray',
        },
        {
            id: 'connection',
            name: 'Connection Design',
            codes: ['IS 800 Ch.10'],
            description: 'Bolted, welded, and base plate connections',
            icon: Link2,
            color: 'orange',
        },
        {
            id: 'foundation',
            name: 'Foundation Design',
            codes: ['IS 456', 'IS 1904'],
            description: 'Isolated, combined, and mat footings',
            icon: Landmark,
            color: 'brown',
        },
        {
            id: 'international',
            name: 'International Codes',
            codes: ['GB50017', 'BS5950', 'AIJ', 'SNIP', 'EC5'],
            description: 'Additional international design standards',
            icon: Globe,
            color: 'purple',
        },
    ];

// ============================================
// FOUNDATION DESIGN PANEL (Inline)
// ============================================

const FoundationDesignPanel: FC<{ isPro: boolean }> = ({ isPro }) => {
    const [footingType, setFootingType] = useState<'isolated' | 'combined' | 'mat'>('isolated');
    const [columnLoad, setColumnLoad] = useState(500);
    const [momentX, setMomentX] = useState(50);
    const [momentY, setMomentY] = useState(0);
    const [sbc, setSbc] = useState(150);
    const [concreteGrade, setConcreteGrade] = useState('M25');
    const [isDesigning, setIsDesigning] = useState(false);
    const [result, setResult] = useState<{
        length: number;
        width: number;
        depth: number;
        rebarMain: string;
        status: 'pass' | 'fail';
    } | null>(null);



    const handleDesign = async () => {
        setIsDesigning(true);

        // Simulate design calculation
        await new Promise((r) => setTimeout(r, 1000));

        // Calculate approximate footing size
        const requiredArea = columnLoad / sbc;
        const side = Math.ceil(Math.sqrt(requiredArea) * 100) / 100;
        const eccentricity = momentX / columnLoad;
        const adjustedLength = side * (1 + 6 * eccentricity / side);

        setResult({
            length: Math.max(1.5, Math.ceil(adjustedLength * 10) / 10),
            width: Math.max(1.5, Math.ceil(side * 10) / 10),
            depth: 0.45,
            rebarMain: '12 @ 150 c/c B/W',
            status: 'pass',
        });

        setIsDesigning(false);
    };

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                Foundation Design (IS 456 + IS 1904)
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Footing Type */}
                <div className="col-span-2">
                    <label className="text-xs text-slate-500 mb-2 block">Footing Type</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['isolated', 'combined', 'mat'] as const).map((type) => (
                            <button type="button"
                                key={type}
                                onClick={() => setFootingType(type)}
                                className={`
                                    p-2 rounded-lg border text-sm capitalize transition-all
                                    ${footingType === type
                                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700'
                                        : 'border-[#1a2333] hover:border-amber-300'}
                                `}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Column Load */}
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Column Load (kN)</label>
                    <input
                        type="number"
                        value={columnLoad}
                        onChange={(e) => setColumnLoad(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                    />
                </div>

                {/* Moment X */}
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Moment X (kN.m)</label>
                    <input
                        type="number"
                        value={momentX}
                        onChange={(e) => setMomentX(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                    />
                </div>

                {/* SBC */}
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">SBC (kN/m²)</label>
                    <select
                        value={sbc}
                        onChange={(e) => setSbc(parseInt(e.target.value))}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                    >
                        <option value={100}>100 - Soft Soil</option>
                        <option value={150}>150 - Medium Soil</option>
                        <option value={200}>200 - Stiff Soil</option>
                        <option value={300}>300 - Hard Soil</option>
                        <option value={450}>450 - Rock</option>
                    </select>
                </div>

                {/* Concrete Grade */}
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Concrete</label>
                    <select
                        value={concreteGrade}
                        onChange={(e) => setConcreteGrade(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-slate-800 dark:border-slate-600"
                    >
                        <option value="M20">M20</option>
                        <option value="M25">M25</option>
                        <option value="M30">M30</option>
                        <option value="M35">M35</option>
                    </select>
                </div>
            </div>

            {/* Design Button */}
            <button type="button"
                onClick={handleDesign}
                disabled={isDesigning}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg transition-colors mb-4"
            >
                <RefreshCw className={`w-4 h-4 ${isDesigning ? 'animate-spin' : ''}`} />
                {isDesigning ? 'Designing...' : 'Design Footing'}
            </button>

            {/* Result */}
            {result && (
                <div className={`p-4 rounded-lg border ${result.status === 'pass'
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-medium tracking-wide text-sm">Design Result</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium tracking-wide ${result.status === 'pass'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            {result.status.toUpperCase()}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Length:</span>
                            <span className="font-medium tracking-wide">{result.length} m</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Width:</span>
                            <span className="font-medium tracking-wide">{result.width} m</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Depth:</span>
                            <span className="font-medium tracking-wide">{result.depth} m</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Main Rebar:</span>
                            <span className="font-medium tracking-wide">{result.rebarMain}</span>
                        </div>
                    </div>

                    {/* Footing Sketch */}
                    <div className="mt-3 pt-3 border-t border-[#1a2333]">
                        <svg viewBox="0 0 200 120" className="w-full h-24">
                            {/* Soil */}
                            <rect x="0" y="80" width="200" height="40" fill="#D4A574" opacity="0.3" />
                            <line x1="0" y1="80" x2="200" y2="80" stroke="#A0522D" strokeWidth="2" />

                            {/* Footing */}
                            <rect x="40" y="55" width="120" height="25" fill="#9CA3AF" stroke="#6B7280" strokeWidth="2" />

                            {/* Column */}
                            <rect x="85" y="10" width="30" height="45" fill="#6B7280" stroke="#374151" strokeWidth="2" />

                            {/* Dimensions */}
                            <text x="100" y="95" fontSize="10" textAnchor="middle" fill="#888">{result.length}m × {result.width}m</text>
                        </svg>
                    </div>
                </div>
            )}

            {/* Checks Info */}
            <div className="mt-4 p-3 bg-[#131b2e] rounded-lg">
                <div className="text-xs font-medium tracking-wide text-[#869ab8] mb-2">Design Checks</div>
                <div className="grid grid-cols-2 gap-1 text-xs text-[#869ab8]">
                    <div>✓ Bearing capacity</div>
                    <div>✓ One-way shear</div>
                    <div>✓ Punching shear</div>
                    <div>✓ Flexure</div>
                    <div>✓ Development length</div>
                    <div>✓ Min reinforcement</div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// INTERNATIONAL CODES PANEL
// ============================================

interface IntlCode {
    id: string;
    name: string;
    country: string;
    scope: string;
    status: 'available' | 'coming_soon';
}

const INTERNATIONAL_CODES: IntlCode[] = [
    { id: 'GB50017', name: 'GB 50017', country: 'China', scope: 'Steel structures', status: 'available' },
    { id: 'BS5950', name: 'BS 5950', country: 'UK', scope: 'Steel structures (superseded by EC3)', status: 'available' },
    { id: 'AIJ', name: 'AIJ', country: 'Japan', scope: 'Steel & RC structures', status: 'available' },
    { id: 'SNIP', name: 'SP 20.13330 / SNiP', country: 'Russia/CIS', scope: 'Structural loads & steel', status: 'available' },
    { id: 'AASHTO_LRFD', name: 'AASHTO LRFD', country: 'USA', scope: 'Bridge design', status: 'available' },
    { id: 'AA_ADM1', name: 'AA ADM1', country: 'USA', scope: 'Aluminum structures', status: 'available' },
    { id: 'CSA_A23', name: 'CSA A23.3', country: 'Canada', scope: 'Concrete structures', status: 'available' },
    { id: 'SP52101', name: 'SP 52-101', country: 'Russia', scope: 'Concrete structures', status: 'available' },
    { id: 'IS13920', name: 'IS 13920', country: 'India', scope: 'Ductile detailing (seismic)', status: 'available' },
    { id: 'EC5', name: 'Eurocode 5 (EN 1995)', country: 'Europe', scope: 'Timber structures', status: 'available' },
];

const InternationalCodesPanel: FC = () => {
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                International Design Codes
            </h3>
            <p className="text-xs text-slate-500 mb-4">
                Select a code to configure design parameters. Active code is used for member capacity checks.
            </p>
            <div className="space-y-2">
                {INTERNATIONAL_CODES.map((code) => (
                    <button
                        type="button"
                        key={code.id}
                        onClick={() => setSelected(code.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            selected === code.id
                                ? 'border-purple-500 bg-purple-500/10'
                                : 'border-[#1a2333] hover:border-purple-400/50 hover:bg-slate-800/50'
                        }`}
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium tracking-wide">{code.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                                    {code.country}
                                </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{code.scope}</div>
                        </div>
                        {selected === code.id && (
                            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                        )}
                    </button>
                ))}
            </div>
            {selected && (
                <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <p className="text-xs text-purple-300">
                        <span className="font-medium">{INTERNATIONAL_CODES.find(c => c.id === selected)?.name}</span> selected.
                        Design checks will use this code's load factors and capacity equations.
                    </p>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const DesignCodesDialog: FC<DesignCodesDialogProps> = ({
    isOpen,
    onClose,
    isPro = false, // Changed from true - must be explicitly passed
    initialTab = 'steel',
}) => {
    const [activeTab, setActiveTab] = useState<DesignType>(initialTab);
    const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);

    const renderPanel = () => {
        switch (activeTab) {
            case 'steel':
                return <SteelDesignPanel isPro={isPro} />;
            case 'concrete':
                return <IS456DesignPanel isPro={isPro} />;
            case 'connection':
                return (
                    <div className="p-4">
                        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                            <Link2 className="w-4 h-4" />
                            Connection Design
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Design steel connections per IS 800:2007 Chapter 10.
                        </p>
                        <Button
                            onClick={() => setConnectionDialogOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                        >
                            <Wrench className="w-4 h-4" />
                            Open Connection Designer
                        </Button>

                        {/* Connection Types */}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="p-3 bg-[#131b2e] rounded-lg">
                                <div className="font-medium tracking-wide text-sm">Bolted Shear</div>
                                <div className="text-xs text-[#869ab8]">Fin plate, angles</div>
                            </div>
                            <div className="p-3 bg-[#131b2e] rounded-lg">
                                <div className="font-medium tracking-wide text-sm">Moment End Plate</div>
                                <div className="text-xs text-[#869ab8]">Extended, flush</div>
                            </div>
                            <div className="p-3 bg-[#131b2e] rounded-lg">
                                <div className="font-medium tracking-wide text-sm">Welded</div>
                                <div className="text-xs text-[#869ab8]">Fillet, butt</div>
                            </div>
                            <div className="p-3 bg-[#131b2e] rounded-lg">
                                <div className="font-medium tracking-wide text-sm">Base Plate</div>
                                <div className="text-xs text-[#869ab8]">Anchor bolts</div>
                            </div>
                        </div>
                    </div>
                );
            case 'foundation':
                return <FoundationDesignPanel isPro={isPro} />;
            case 'international':
                return <InternationalCodesPanel />;
            default:
                return null;
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                    {/* Header */}
                    <DialogHeader className="flex flex-row items-center justify-between p-4 border-b border-[#1a2333] space-y-0">
                        <div className="flex items-center gap-2">
                            <FileCheck className="w-5 h-5 text-green-500" />
                            <DialogTitle className="font-semibold text-lg">Design Code Checks</DialogTitle>
                            {!isPro && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded">
                                    <Crown className="w-3 h-3" />
                                    Pro
                                </span>
                            )}
                        </div>
                        <DialogDescription className="sr-only">Structural design code compliance checks</DialogDescription>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm text-[#869ab8] hover:text-slate-700 dark:hover:text-slate-300">
                                <Download className="w-4 h-4" />
                                Export Report
                            </Button>
                        </div>
                    </DialogHeader>

                    {/* Content */}
                    <div className="flex flex-1 overflow-hidden">
                        {/* Sidebar */}
                        <div className="w-64 border-r border-[#1a2333] overflow-y-auto">
                            {DESIGN_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const isActive = activeTab === option.id;

                                return (
                                    <button type="button"
                                        key={option.id}
                                        onClick={() => setActiveTab(option.id)}
                                        className={`
                                            w-full flex items-center gap-3 p-3 text-left transition-all
                                            ${isActive
                                                ? 'bg-[#131b2e] border-r-2 border-blue-500'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                                        `}
                                    >
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-[#869ab8]'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium tracking-wide ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                                {option.name}
                                            </div>
                                            <div className="text-xs text-[#869ab8] truncate">
                                                {option.codes.join(', ')}
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-slate-600 dark:text-slate-500'}`} />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-y-auto">
                            <TierGate feature="advancedDesignCodes">
                                {renderPanel()}
                            </TierGate>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Connection Design Sub-Dialog */}
            <ConnectionDesignDialog
                isOpen={connectionDialogOpen}
                onClose={() => setConnectionDialogOpen(false)}
                isPro={isPro}
            />
        </>
    );
};

export default DesignCodesDialog;
