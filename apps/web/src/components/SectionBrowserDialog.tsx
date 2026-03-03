/**
 * SectionBrowserDialog.tsx - Steel Section Browser
 * Connects to Rust backend for steel section database search & selection
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Search, Database, Check, Loader2, AlertCircle, ArrowUpDown } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '@/store/model';
import { useShallow } from 'zustand/react/shallow';
import { useSteelSections } from '@/hooks/useRustAnalysis';

const STANDARDS = [
    { value: 'is', label: 'Indian Standard (IS)' },
    { value: 'aisc', label: 'AISC (US)' },
    { value: 'bs', label: 'British Standard (BS)' },
    { value: 'en', label: 'Eurocode (EN)' },
];

type SortField = 'designation' | 'depth' | 'width' | 'area' | 'weight' | 'ix' | 'iy';
type SortDir = 'asc' | 'desc';

const SectionBrowserDialog: React.FC = () => {
    const { modals, setModal } = useUIStore(
      useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
    );
    const isOpen = modals.sectionBrowserDialog || false;

    const [standard, setStandard] = useState('is');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDesignation, setSelectedDesignation] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('designation');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const { sections, loading, error, search } = useSteelSections(standard);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) return;
        const timer = setTimeout(() => {
            search(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, search]);

    // Sort sections
    const sortedSections = React.useMemo(() => {
        const filtered = searchQuery.trim()
            ? sections
            : sections;
        return [...filtered].sort((a, b) => {
            const av = a[sortField];
            const bv = b[sortField];
            if (typeof av === 'string' && typeof bv === 'string') {
                return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            }
            const an = Number(av) || 0;
            const bn = Number(bv) || 0;
            return sortDir === 'asc' ? an - bn : bn - an;
        });
    }, [sections, sortField, sortDir, searchQuery]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const selectedSection = sections.find(s => s.designation === selectedDesignation);

    const handleApply = useCallback(() => {
        if (!selectedSection) return;
        // Apply selected section to all selected members
        const { selectedIds, members } = useModelStore.getState();
        const memberIds = Array.from(selectedIds).filter((id: string) => members.has(id));
        if (memberIds.length > 0) {
            const newMembers = new Map(members);
            memberIds.forEach((memberId: string) => {
                const member = newMembers.get(memberId);
                if (member) {
                    newMembers.set(memberId, {
                        ...member,
                        sectionId: selectedSection.designation,
                        sectionType: 'I-BEAM' as const,
                        dimensions: {
                            height: selectedSection.depth / 1000,
                            width: selectedSection.width / 1000,
                        },
                        A: selectedSection.area * 1e-6,
                        I: selectedSection.ix * 1e-12,
                        Iy: selectedSection.iy * 1e-12,
                    });
                }
            });
            useModelStore.setState({ members: newMembers });
        }
        setModal('sectionBrowserDialog', false);
    }, [selectedSection, setModal]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setModal('sectionBrowserDialog', open)}>
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-cyan-500" />
                        Steel Section Browser
                        <Badge variant="secondary" className="ml-2">
                            {sections.length} Sections
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Browse and search steel sections from the Rust backend database
                    </DialogDescription>
                </DialogHeader>

                {/* Toolbar */}
                <div className="flex items-center gap-3">
                    <div className="w-48">
                        <Select value={standard} onValueChange={v => { setStandard(v); setSearchQuery(''); setSelectedDesignation(null); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {STANDARDS.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search sections (e.g. ISMB 200, W 200x46...)"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />}
                </div>

                {error && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 rounded">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                    </div>
                )}

                {/* Table */}
                <ScrollArea className="flex-1 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                            <tr>
                                {([
                                    ['designation', 'Designation'],
                                    ['depth', 'Depth (mm)'],
                                    ['width', 'Width (mm)'],
                                    ['area', 'Area (mm²)'],
                                    ['weight', 'Weight (kg/m)'],
                                    ['ix', 'Ix (mm⁴)'],
                                    ['iy', 'Iy (mm⁴)'],
                                ] as [SortField, string][]).map(([field, label]) => (
                                    <th
                                        key={field}
                                        className="px-3 py-2 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                                        onClick={() => toggleSort(field)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {label}
                                            {sortField === field && (
                                                <ArrowUpDown className="h-3 w-3 text-cyan-500" />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSections.map(section => (
                                <tr
                                    key={section.designation}
                                    className={`border-t cursor-pointer transition-colors ${
                                        selectedDesignation === section.designation
                                            ? 'bg-cyan-50 dark:bg-cyan-950 border-cyan-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                                    }`}
                                    onClick={() => setSelectedDesignation(section.designation)}
                                >
                                    <td className="px-3 py-1.5 font-medium">{section.designation}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{section.depth.toFixed(1)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{section.width.toFixed(1)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{section.area.toFixed(0)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{section.weight.toFixed(1)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{section.ix.toFixed(0)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{section.iy.toFixed(0)}</td>
                                </tr>
                            ))}
                            {!loading && sortedSections.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                                        {searchQuery ? 'No sections match your search' : 'No sections available'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </ScrollArea>

                {/* Selected Section Detail */}
                {selectedSection && (
                    <div className="p-3 bg-cyan-50 dark:bg-cyan-950 rounded-lg border border-cyan-200 dark:border-cyan-800">
                        <div className="flex items-center gap-3">
                            <Check className="h-4 w-4 text-cyan-600" />
                            <div className="text-sm">
                                <span className="font-bold">{selectedSection.designation}</span>
                                {' — '}
                                {selectedSection.depth}×{selectedSection.width}mm,{' '}
                                Area: {selectedSection.area.toFixed(0)}mm²,{' '}
                                Ix: {selectedSection.ix.toFixed(0)}mm⁴,{' '}
                                Iy: {selectedSection.iy.toFixed(0)}mm⁴,{' '}
                                Zx: {selectedSection.zx.toFixed(0)}mm³,{' '}
                                Zy: {selectedSection.zy.toFixed(0)}mm³
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('sectionBrowserDialog', false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApply}
                        disabled={!selectedDesignation}
                        className="bg-cyan-600 hover:bg-cyan-700"
                    >
                        <Database className="h-4 w-4 mr-2" />
                        Assign to Selected Members
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SectionBrowserDialog;
