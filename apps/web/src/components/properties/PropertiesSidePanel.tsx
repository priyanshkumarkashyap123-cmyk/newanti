/**
 * PropertiesSidePanel.tsx — Unified Properties Assignment Center
 * 
 * Replaces fragmented modals (SectionAssignDialog, MaterialLibraryDialog, MemberReleasesDialog)
 * with a unified docked side panel for continuous modeling workflow.
 */

import React, { useState, useMemo } from 'react';
import { Layers, Database, Unlock, Scale3d, CheckCircle2, ChevronRight, Activity, Move } from 'lucide-react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../lib/utils'; // Assuming standard cn utility exists

// Define tabs matching our properties
type PropertyTab = "section" | "material" | "releases" | "offsets";

export const PropertiesSidePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PropertyTab>("section");

  const { selectedIds, updateMember, members } = useModelStore(
    useShallow((s) => ({
      selectedIds: s.selectedIds,
      updateMember: s.updateMember,
      members: s.members,
    }))
  );

  const selectedMembers = useMemo(() => 
    Array.from(selectedIds)
      .map(id => members.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m),
    [selectedIds, members]
  );

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-slate-900/95 border-r border-[#1a2333] shadow-lg animate-in fade-in slide-in-from-left-4">
      {/* Header */}
      <div className="p-4 border-b border-[#1a2333]/60 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-500" />
          Properties Assignment
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Assign cross-sections, materials, and releases.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex px-3 pt-2 gap-2 border-b border-[#1a2333]/60 shrink-0 overflow-x-auto eng-scroll">
        <TabButton id="section" label="Section" icon={Scale3d} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="material" label="Material" icon={Database} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="releases" label="Releases" icon={Unlock} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="offsets" label="Offsets" icon={Move} activeTab={activeTab} onClick={setActiveTab} />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto eng-scroll p-4">
        {activeTab === "section" && <SectionAssignmentPane members={selectedMembers} onAssign={updateMember} />}
        {activeTab === "material" && <MaterialAssignmentPane members={selectedMembers} onAssign={updateMember} />}
        {activeTab === "releases" && <ReleasesAssignmentPane members={selectedMembers} onAssign={updateMember} />}
        {activeTab === "offsets" && <OffsetsAssignmentPane members={selectedMembers} onAssign={updateMember} />}
      </div>

      {/* Footer Status */}
      <div className="p-3 border-t border-[#1a2333]/60 shrink-0 bg-slate-50 dark:bg-slate-950/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Selected Members:</span>
          {selectedMembers.length > 0 ? (
            <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
              {selectedMembers.length}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-500">None</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUB-PANELS (Stubs for the exact forms)
// ==========================================

const SectionAssignmentPane = ({ members, onAssign }: any) => {
  // Stubbing the logic that was in SectionAssignDialog
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-100 dark:bg-[#131b2e] rounded p-3 border border-slate-200 dark:border-slate-800">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">Standard Library</label>
        <select className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 mb-3">
          <option>ISMB 300</option>
          <option>W12x65</option>
          <option>HEA 200</option>
        </select>
        
        <button 
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
          disabled={members.length === 0}
          onClick={() => {
            // Assignment logic
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Assign to Selected ({members.length})
        </button>
      </div>

      <div className="bg-slate-100 dark:bg-[#131b2e] rounded p-3 border border-slate-200 dark:border-slate-800">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">Parametric Shape</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span className="text-[10px] text-slate-500 block">Depth (mm)</span>
            <input type="number" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" placeholder="300" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Width (mm)</span>
            <input type="number" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" placeholder="150" />
          </div>
        </div>
      </div>
    </div>
  );
};

const MaterialAssignmentPane = ({ members, onAssign }: any) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-100 dark:bg-[#131b2e] rounded p-3 border border-slate-200 dark:border-slate-800">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">Material Database</label>
        <select className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 mb-3">
          <option>Steel (Structural)</option>
          <option>Concrete (M30)</option>
          <option>Aluminum</option>
        </select>
        
        <button 
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
          disabled={members.length === 0}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Assign to Selected ({members.length})
        </button>
      </div>
    </div>
  );
}

const ReleasesAssignmentPane = ({ members, onAssign }: any) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-100 dark:bg-[#131b2e] rounded p-3 border border-slate-200 dark:border-slate-800">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">Release Type</label>
        <div className="flex flex-col gap-2 mb-4">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="radio" name="release_type" defaultChecked /> Fully Fixed
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="radio" name="release_type" /> Pinned (Mx, My, Mz Released)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="radio" name="release_type" /> Custom Releases
          </label>
        </div>

        <button 
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
          disabled={members.length === 0}
          onClick={() => {
            members.forEach((m: any) => {
              onAssign(m.id, {
                releases: {
                  mxStart: false, myStart: false, mzStart: false,
                  mxEnd: false, myEnd: false, mzEnd: false
                }
              });
            });
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Apply Releases ({members.length})
        </button>
      </div>
    </div>
  );
}

const OffsetsAssignmentPane = ({ members, onAssign }: any) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-100 dark:bg-[#131b2e] rounded p-3 border border-slate-200 dark:border-slate-800">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">Member Offsets (m)</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <span className="text-[10px] text-slate-500 block">Start X</span>
            <input type="number" step="0.1" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Start Y</span>
            <input type="number" step="0.1" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Start Z</span>
            <input type="number" step="0.1" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div>
            <span className="text-[10px] text-slate-500 block">End X</span>
            <input type="number" step="0.1" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">End Y</span>
            <input type="number" step="0.1" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">End Z</span>
            <input type="number" step="0.1" className="w-full bg-white dark:bg-[#0b1326] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs" />
          </div>
        </div>

        <button 
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
          disabled={members.length === 0}
          onClick={() => {
            members.forEach((m: any) => {
              onAssign(m.id, {
                startOffset: { x: 0, y: 0, z: 0 },
                endOffset: { x: 0, y: 0, z: 0 }
              });
            });
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Apply Offsets ({members.length})
        </button>
      </div>
    </div>
  );
}

// ==========================================
// TABS HELPER
// ==========================================
const TabButton = ({ id, label, icon: Icon, activeTab, onClick }: any) => {
  const isActive = activeTab === id;
  return (
    <button type="button"
      onClick={() => onClick(id)}
      className={cn(
        "flex items-center gap-1.5 pb-2 px-1 border-b-2 transition-colors text-xs font-medium",
        isActive 
          ? "border-blue-500 text-blue-600 dark:text-blue-400" 
          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};
