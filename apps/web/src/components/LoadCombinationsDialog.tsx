/**
 * LoadCombinationsDialog.tsx - Load Combinations Generator UI
 * Supports predefined combinations (ASCE 7, IS 456) and user-defined
 */

import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
    Layers, Plus, Trash2, Copy, Check, AlertCircle,
    ChevronDown, ChevronRight, FileText
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

// ===== PREDEFINED COMBINATIONS =====

interface LoadFactor {
    type: string;
    factor: number;
}

interface LoadCombination {
    id: string;
    name: string;
    code: string;
    factors: LoadFactor[];
    isActive: boolean;
    isUserDefined: boolean;
}

// ASCE 7 LRFD Combinations
const ASCE7_LRFD: LoadCombination[] = [
    { id: 'ASCE7_1', name: '1.4D', code: 'ASCE7_LRFD', factors: [{ type: 'D', factor: 1.4 }], isActive: true, isUserDefined: false },
    { id: 'ASCE7_2', name: '1.2D + 1.6L + 0.5Lr', code: 'ASCE7_LRFD', factors: [{ type: 'D', factor: 1.2 }, { type: 'L', factor: 1.6 }, { type: 'Lr', factor: 0.5 }], isActive: true, isUserDefined: false },
    { id: 'ASCE7_3', name: '1.2D + 1.6L + 0.5S', code: 'ASCE7_LRFD', factors: [{ type: 'D', factor: 1.2 }, { type: 'L', factor: 1.6 }, { type: 'S', factor: 0.5 }], isActive: true, isUserDefined: false },
    { id: 'ASCE7_4', name: '1.2D + 1.0W + L + 0.5Lr', code: 'ASCE7_LRFD', factors: [{ type: 'D', factor: 1.2 }, { type: 'W', factor: 1.0 }, { type: 'L', factor: 1.0 }, { type: 'Lr', factor: 0.5 }], isActive: true, isUserDefined: false },
    { id: 'ASCE7_5', name: '1.2D + 1.0E + L + 0.2S', code: 'ASCE7_LRFD', factors: [{ type: 'D', factor: 1.2 }, { type: 'E', factor: 1.0 }, { type: 'L', factor: 1.0 }, { type: 'S', factor: 0.2 }], isActive: true, isUserDefined: false },
    { id: 'ASCE7_6', name: '0.9D + 1.0W', code: 'ASCE7_LRFD', factors: [{ type: 'D', factor: 0.9 }, { type: 'W', factor: 1.0 }], isActive: true, isUserDefined: false },
    { id: 'ASCE7_7', name: '0.9D + 1.0E', code: 'ASCE7_LRFD', factors: [{ type: 'D', factor: 0.9 }, { type: 'E', factor: 1.0 }], isActive: true, isUserDefined: false },
];

// IS 456 LSM Combinations
const IS456_LSM: LoadCombination[] = [
    { id: 'IS456_1', name: '1.5(DL + LL)', code: 'IS456_LSM', factors: [{ type: 'D', factor: 1.5 }, { type: 'L', factor: 1.5 }], isActive: true, isUserDefined: false },
    { id: 'IS456_2a', name: '1.2(DL + LL + EL)', code: 'IS456_LSM', factors: [{ type: 'D', factor: 1.2 }, { type: 'L', factor: 1.2 }, { type: 'E', factor: 1.2 }], isActive: true, isUserDefined: false },
    { id: 'IS456_2b', name: '1.2(DL + LL - EL)', code: 'IS456_LSM', factors: [{ type: 'D', factor: 1.2 }, { type: 'L', factor: 1.2 }, { type: 'E', factor: -1.2 }], isActive: true, isUserDefined: false },
    { id: 'IS456_3a', name: '1.5(DL + EL)', code: 'IS456_LSM', factors: [{ type: 'D', factor: 1.5 }, { type: 'E', factor: 1.5 }], isActive: true, isUserDefined: false },
    { id: 'IS456_3b', name: '1.5(DL - EL)', code: 'IS456_LSM', factors: [{ type: 'D', factor: 1.5 }, { type: 'E', factor: -1.5 }], isActive: true, isUserDefined: false },
    { id: 'IS456_4a', name: '0.9DL + 1.5EL', code: 'IS456_LSM', factors: [{ type: 'D', factor: 0.9 }, { type: 'E', factor: 1.5 }], isActive: true, isUserDefined: false },
    { id: 'IS456_4b', name: '0.9DL - 1.5EL', code: 'IS456_LSM', factors: [{ type: 'D', factor: 0.9 }, { type: 'E', factor: -1.5 }], isActive: true, isUserDefined: false },
    { id: 'IS456_5a', name: '1.2(DL + LL + WL)', code: 'IS456_LSM', factors: [{ type: 'D', factor: 1.2 }, { type: 'L', factor: 1.2 }, { type: 'W', factor: 1.2 }], isActive: true, isUserDefined: false },
    { id: 'IS456_6a', name: '1.5(DL + WL)', code: 'IS456_LSM', factors: [{ type: 'D', factor: 1.5 }, { type: 'W', factor: 1.5 }], isActive: true, isUserDefined: false },
    { id: 'IS456_7a', name: '0.9DL + 1.5WL', code: 'IS456_LSM', factors: [{ type: 'D', factor: 0.9 }, { type: 'W', factor: 1.5 }], isActive: true, isUserDefined: false },
];

const LOAD_TYPES = ['D', 'L', 'Lr', 'S', 'R', 'W', 'E', 'T'];

const LoadCombinationsDialog: React.FC = () => {
    const { modals, setModal } = useUIStore();
    const isOpen = modals.loadCombinationsDialog || false;

    const [activeTab, setActiveTab] = useState('predefined');
    const [combinations, setCombinations] = useState<LoadCombination[]>([
        ...ASCE7_LRFD,
        ...IS456_LSM,
    ]);

    const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({
        'ASCE7_LRFD': true,
        'IS456_LSM': false,
        'USER': true,
    });

    // New combination state
    const [newComboName, setNewComboName] = useState('');
    const [newComboFactors, setNewComboFactors] = useState<LoadFactor[]>([
        { type: 'D', factor: 1.0 },
    ]);

    const formatExpression = (factors: LoadFactor[]): string => {
        return factors
            .filter(f => f.factor !== 0)
            .map(f => {
                if (f.factor === 1.0) return f.type;
                if (f.factor === -1.0) return `-${f.type}`;
                return `${f.factor}${f.type}`;
            })
            .join(' + ')
            .replace(/\+ -/g, '- ');
    };

    const toggleCombination = useCallback((id: string) => {
        setCombinations(prev => prev.map(c =>
            c.id === id ? { ...c, isActive: !c.isActive } : c
        ));
    }, []);

    const toggleAllInCode = useCallback((code: string, active: boolean) => {
        setCombinations(prev => prev.map(c =>
            c.code === code ? { ...c, isActive: active } : c
        ));
    }, []);

    const deleteCombination = useCallback((id: string) => {
        setCombinations(prev => prev.filter(c => c.id !== id));
    }, []);

    const duplicateCombination = useCallback((combo: LoadCombination) => {
        const newCombo: LoadCombination = {
            ...combo,
            id: `USER_${Date.now()}`,
            name: `${combo.name} (Copy)`,
            code: 'USER',
            isUserDefined: true,
        };
        setCombinations(prev => [...prev, newCombo]);
    }, []);

    const addNewCombination = useCallback(() => {
        if (!newComboName.trim()) return;

        const newCombo: LoadCombination = {
            id: `USER_${Date.now()}`,
            name: newComboName,
            code: 'USER',
            factors: newComboFactors.filter(f => f.factor !== 0),
            isActive: true,
            isUserDefined: true,
        };

        setCombinations(prev => [...prev, newCombo]);
        setNewComboName('');
        setNewComboFactors([{ type: 'D', factor: 1.0 }]);
    }, [newComboName, newComboFactors]);

    const addFactorField = useCallback(() => {
        const usedTypes = newComboFactors.map(f => f.type);
        const nextType = LOAD_TYPES.find(t => !usedTypes.includes(t)) || 'D';
        setNewComboFactors(prev => [...prev, { type: nextType, factor: 1.0 }]);
    }, [newComboFactors]);

    const updateFactorField = useCallback((index: number, field: 'type' | 'factor', value: string | number) => {
        setNewComboFactors(prev => prev.map((f, i) =>
            i === index ? { ...f, [field]: value } : f
        ));
    }, []);

    const removeFactorField = useCallback((index: number) => {
        setNewComboFactors(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Group combinations by code
    const groupedCombinations = combinations.reduce((acc, combo) => {
        const code = combo.isUserDefined ? 'USER' : combo.code;
        if (!acc[code]) acc[code] = [];
        acc[code].push(combo);
        return acc;
    }, {} as Record<string, LoadCombination[]>);

    const activeCombinations = combinations.filter(c => c.isActive);

    const handleApply = () => {
// console.log('Applying load combinations:', activeCombinations);
        setModal('loadCombinationsDialog', false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setModal('loadCombinationsDialog', open)}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-purple-500" />
                        Load Combinations
                        <Badge variant="secondary" className="ml-2">
                            {activeCombinations.length} Active
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Select predefined load combinations or create custom ones
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="predefined">
                            <FileText className="h-4 w-4 mr-1" />
                            Predefined
                        </TabsTrigger>
                        <TabsTrigger value="custom">
                            <Plus className="h-4 w-4 mr-1" />
                            Create Custom
                        </TabsTrigger>
                    </TabsList>

                    {/* Predefined Tab */}
                    <TabsContent value="predefined" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-4">
                                {Object.entries(groupedCombinations).map(([code, combos]) => {
                                    const isExpanded = expandedCodes[code] ?? true;
                                    const activeCount = combos.filter(c => c.isActive).length;
                                    const codeLabel = code === 'ASCE7_LRFD' ? 'ASCE 7 LRFD'
                                        : code === 'IS456_LSM' ? 'IS 456 LSM'
                                            : 'User Defined';

                                    return (
                                        <div key={code} className="border rounded-lg">
                                            <div
                                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                                                onClick={() => setExpandedCodes(prev => ({ ...prev, [code]: !prev[code] }))}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    <span className="font-medium">{codeLabel}</span>
                                                    <Badge variant="outline">{activeCount}/{combos.length}</Badge>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => { e.stopPropagation(); toggleAllInCode(code, true); }}
                                                    >
                                                        Select All
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => { e.stopPropagation(); toggleAllInCode(code, false); }}
                                                    >
                                                        Clear All
                                                    </Button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t divide-y">
                                                    {combos.map(combo => (
                                                        <div
                                                            key={combo.id}
                                                            className="flex items-center justify-between p-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-900"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Checkbox
                                                                    checked={combo.isActive}
                                                                    onCheckedChange={() => toggleCombination(combo.id)}
                                                                />
                                                                <div>
                                                                    <div className="font-medium text-sm">{combo.name}</div>
                                                                    <div className="text-xs text-muted-foreground font-mono">
                                                                        {formatExpression(combo.factors)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7"
                                                                    onClick={() => duplicateCombination(combo)}
                                                                    title="Duplicate"
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </Button>
                                                                {combo.isUserDefined && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-7 w-7 text-red-500"
                                                                        onClick={() => deleteCombination(combo.id)}
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* Custom Tab */}
                    <TabsContent value="custom" className="flex-1 overflow-y-auto space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Combination Name</Label>
                            <Input
                                placeholder="e.g., 1.0D + 1.0L + 0.7E"
                                value={newComboName}
                                onChange={e => setNewComboName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Load Factors</Label>
                                <Button size="sm" variant="outline" onClick={addFactorField}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Factor
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {newComboFactors.map((factor, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={factor.factor}
                                            onChange={e => updateFactorField(index, 'factor', parseFloat(e.target.value) || 0)}
                                            className="w-24"
                                        />
                                        <span className="text-muted-foreground">×</span>
                                        <select
                                            value={factor.type}
                                            onChange={e => updateFactorField(index, 'type', e.target.value)}
                                            className="h-9 rounded-md border bg-background px-3"
                                        >
                                            {LOAD_TYPES.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                        <span className="text-xs text-muted-foreground min-w-[60px]">
                                            {factor.type === 'D' && '(Dead)'}
                                            {factor.type === 'L' && '(Live)'}
                                            {factor.type === 'Lr' && '(Roof Live)'}
                                            {factor.type === 'S' && '(Snow)'}
                                            {factor.type === 'R' && '(Rain)'}
                                            {factor.type === 'W' && '(Wind)'}
                                            {factor.type === 'E' && '(Earthquake)'}
                                            {factor.type === 'T' && '(Temperature)'}
                                        </span>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => removeFactorField(index)}
                                            disabled={newComboFactors.length <= 1}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <div className="text-sm font-medium">Preview</div>
                            <div className="font-mono text-lg mt-1">
                                {formatExpression(newComboFactors) || '(empty)'}
                            </div>
                        </div>

                        <Button onClick={addNewCombination} disabled={!newComboName.trim()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Combination
                        </Button>

                        {groupedCombinations['USER']?.length > 0 && (
                            <div className="border-t pt-4">
                                <Label className="text-muted-foreground">Your Custom Combinations</Label>
                                <div className="mt-2 space-y-2">
                                    {groupedCombinations['USER'].map(combo => (
                                        <div key={combo.id} className="flex items-center justify-between p-2 border rounded">
                                            <div>
                                                <div className="font-medium text-sm">{combo.name}</div>
                                                <div className="text-xs font-mono text-muted-foreground">
                                                    {formatExpression(combo.factors)}
                                                </div>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="text-red-500"
                                                onClick={() => deleteCombination(combo.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <div className="border-t pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">
                            <strong>{activeCombinations.length}</strong> combinations selected for analysis
                        </span>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('loadCombinationsDialog', false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApply}
                        disabled={activeCombinations.length === 0}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        <Layers className="h-4 w-4 mr-2" />
                        Apply {activeCombinations.length} Combinations
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LoadCombinationsDialog;
