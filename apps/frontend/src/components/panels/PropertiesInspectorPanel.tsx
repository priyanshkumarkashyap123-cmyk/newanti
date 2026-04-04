import React, { FC, useState, useMemo } from 'react';
import { useModelStore } from '../../store/model';
import SectionDatabase, { type SectionType } from '../../data/SectionDatabase';
const { STEEL_SECTIONS, MATERIALS_DATABASE, getSectionsByType } = SectionDatabase;
import { useShallow } from 'zustand/react/shallow';
import { Box, Layers, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

export const PropertiesInspectorPanel: FC = () => {
    const { members, selectedIds, updateMember, updateMembers } = useModelStore(
        useShallow(s => ({
            members: s.members, selectedIds: s.selectedIds,
            updateMember: s.updateMember, updateMembers: s.updateMembers
        }))
    );

    const [selectedType, setSelectedType] = useState<SectionType>('W');
    const [selectedSectionId, setSelectedSectionId] = useState<string>('W14x30');
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>('steel-a36');

    const filteredSections = useMemo(() => getSectionsByType(selectedType), [selectedType]);
    const selectedMemberIds = Array.from(selectedIds).filter(id => members.has(id));

    const handleApply = () => {
        const section = STEEL_SECTIONS.find(s => s.id === selectedSectionId);
        if (section) {
            const A = section.A / 1e6;
            const I = section.Ix / 1e12;
            const updates = new Map();
            selectedMemberIds.forEach(id => {
                updates.set(id, { sectionId: selectedSectionId, A, I });
            });
            updateMembers(updates);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden text-[#dae2fd]">
            <div className="p-3 border-b border-[#1a2333] shrink-0">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><Layers className="w-4 h-4 text-purple-400"/> Section Assignment</h3>
                <p className="text-xs text-[#869ab8]">Assign properties to members</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 eng-scroll space-y-4">
                <div className="bg-[#131b2e] p-3 rounded-lg border border-[#1a2333]">
                    <Label className="text-[10px] text-[#869ab8] uppercase mb-1 block">Catalog</Label>
                    <select 
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value as SectionType)}
                        className="w-full bg-[#0b1326] border border-[#1a2333] rounded px-2 py-1.5 text-xs mb-3 text-[#dae2fd]"
                    >
                        <option value="W">W Shapes (AISC)</option>
                        <option value="ISMB">ISMB (Indian)</option>
                        <option value="IPE">IPE (European)</option>
                    </select>

                    <Label className="text-[10px] text-[#869ab8] uppercase mb-1 block">Profile</Label>
                    <select 
                        value={selectedSectionId}
                        onChange={e => setSelectedSectionId(e.target.value)}
                        className="w-full bg-[#0b1326] border border-[#1a2333] rounded px-2 py-1.5 text-xs mb-3 text-[#dae2fd]"
                        size={8}
                    >
                        {filteredSections.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    
                    <Label className="text-[10px] text-[#869ab8] uppercase mb-1 block">Material</Label>
                    <select 
                        value={selectedMaterialId}
                        onChange={e => setSelectedMaterialId(e.target.value)}
                        className="w-full bg-[#0b1326] border border-[#1a2333] rounded px-2 py-1.5 text-xs mb-3 text-[#dae2fd]"
                    >
                        {MATERIALS_DATABASE.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>

                    <Button onClick={handleApply} disabled={selectedMemberIds.length === 0} className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-500 mt-2">
                        Apply to {selectedMemberIds.length} Members
                    </Button>
                </div>
            </div>

            {/* Paintbrush Hint */}
            <div className="p-3 bg-purple-500/10 border-t border-purple-500/20 shrink-0">
                <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-purple-400 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold text-purple-400">Paintbrush Mode Active</p>
                        <p className="text-[10px] text-[#869ab8]">Select a profile, then click members to apply instantly.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
