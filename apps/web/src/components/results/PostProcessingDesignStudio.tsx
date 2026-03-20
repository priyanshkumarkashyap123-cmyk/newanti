/**
 * PostProcessingDesignStudio — STAAD-Pro-class post-processing & design panel
 *
 * Designed for structural engineers:
 *   • Member-by-member design summary (PASS / FAIL / utilization bars)
 *   • RC Beam design — section properties, reinforcement selection, cross-section SVG
 *   • RC Column design — interaction diagram, rebar layout
 *   • Steel design — AISC 360 / IS 800 checks, governing clause
 *   • Section properties table (A, I, Z, r, J)
 *   • Deflection compliance check (span/depth ratio vs code limit)
 *   • Export design report (PDF-ready summary)
 *
 * Consumes data from the Zustand model store (analysisResults + members + nodes).
 */


import React, { FC, useState, useMemo, useCallback } from "react";
import {
  Download,
  Shield,
  AlertTriangle,
  BarChart3,
  Ruler,
  Layers,
  Columns3,
  Building2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";

import {
  useModelStore,
  type AnalysisResults,
  type Member,
  type MemberForceData,
} from "../../store/model";
import {
  MemberDesignService,
  type DesignInput,
  type DesignResult as MemberDesignResult,
  type DesignCheck,
} from "../../services/MemberDesignService";

import {
  type DesignStudioProps,
  type TabId,
  type MemberDesignRow,
  memberLength,
  fmtForce,
} from "./postProcessingTypes";
import SummaryTab from "./SummaryTab";
import RCBeamTab from "./RCBeamTab";
import SteelDesignTab from "./SteelDesignTab";
import SectionPropertiesTab from "./SectionPropertiesTab";
import DeflectionCheckTab from "./DeflectionCheckTab";

// ============================================
// MAIN COMPONENT
// ============================================

const TABS: {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  shortLabel: string;
}[] = [
  {
    id: "summary",
    label: "Design Summary",
    shortLabel: "Summary",
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    id: "rcBeam",
    label: "RC Beam Design",
    shortLabel: "RC Beam",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    id: "steel",
    label: "Steel Design",
    shortLabel: "Steel",
    icon: <Columns3 className="w-4 h-4" />,
  },
  {
    id: "section",
    label: "Section Properties",
    shortLabel: "Sections",
    icon: <Layers className="w-4 h-4" />,
  },
  {
    id: "deflection",
    label: "Deflection Check",
    shortLabel: "Deflection",
    icon: <Ruler className="w-4 h-4" />,
  },
];

export const PostProcessingDesignStudio: FC<DesignStudioProps> = ({
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Dialog handles Escape key natively

  // Store hooks
  const analysisResults = useModelStore((s) => s.analysisResults);
  const members = useModelStore((s) => s.members);
  const nodes = useModelStore((s) => s.nodes);

  // Build design rows for all members
  const designRows = useMemo((): MemberDesignRow[] => {
    if (!analysisResults?.memberForces) return [];
    const rows: MemberDesignRow[] = [];

    members.forEach((m, id) => {
      const forces = analysisResults.memberForces.get(id);
      if (!forces) return;

      const len = memberLength(m, nodes);
      const matType = (m.E ?? 200e6) < 50e6 ? "concrete" : "steel";

      // Derive width/depth from dimensions or infer from A/I
      const sp = m.dimensions;
      const width =
        sp?.width ??
        sp?.rectWidth ??
        (m.A ? Math.round(Math.sqrt(m.A * 1e6) * 0.5) : 200);
      const depth =
        sp?.height ??
        sp?.rectHeight ??
        (m.A && m.I ? Math.round(Math.sqrt((12 * m.I) / m.A) * 1000) : 400);

      let sectionType: "rectangular" | "circular" | "I-section" = "rectangular";
      const st = (m.sectionType ?? "").toLowerCase();
      if (st.includes("circ") || st === "circle") sectionType = "circular";
      else if (st.includes("i") || st === "i-beam" || st.includes("channel"))
        sectionType = "I-section";

      const input: DesignInput = {
        memberId: id,
        memberType:
          Math.abs(forces.axial) > Math.abs(forces.momentZ) * 0.5
            ? "beam-column"
            : "beam",
        material:
          matType === "steel"
            ? {
                type: "steel",
                grade: "Fe250",
                fy: 250,
                fu: 410,
                Es: 200,
              }
            : {
                type: "concrete",
                grade: "M25",
                fck: 25,
                fy: 415,
              },
        section: {
          type: sectionType,
          width,
          depth,
          ...(sp?.flangeThickness
            ? { flangeThickness: sp.flangeThickness }
            : {}),
          ...(sp?.webThickness ? { webThickness: sp.webThickness } : {}),
        },
        forces,
        geometry: {
          length: len,
          kFactor: 1.0,
          laterallyBraced: true,
        },
        code: matType === "steel" ? "IS800" : "IS456",
      };

      let designResult: MemberDesignResult;
      try {
        designResult = MemberDesignService.design(input);
      } catch {
        designResult = {
          memberId: id,
          overallStatus: "WARNING",
          overallUtilization: 0,
          checks: [],
          recommendations: [
            "Design calculation failed — check section properties.",
          ],
        };
      }

      rows.push({
        id,
        label: `M${id}`,
        length: len,
        materialType: matType as "steel" | "concrete" | "custom",
        sectionType: m.sectionType ?? "Default",
        maxAxial: forces.axial,
        maxShearY: forces.shearY,
        maxMomentZ: forces.momentZ,
        utilization: designResult.overallUtilization,
        status: designResult.overallStatus,
        governing: designResult.checks[0]?.name ?? "–",
        designResult,
      });
    });

    return rows;
  }, [analysisResults, members, nodes]);

  // Export handler
  const handleExport = useCallback(() => {
    const lines: string[] = [];
    lines.push("STRUCTURAL DESIGN REPORT");
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push(`Members: ${designRows.length}`);
    lines.push(
      `Pass: ${designRows.filter((r) => r.status === "PASS").length} | Fail: ${designRows.filter((r) => r.status === "FAIL").length} | Warning: ${designRows.filter((r) => r.status === "WARNING").length}`,
    );
    lines.push("");
    lines.push("MEMBER DESIGN SUMMARY");
    lines.push("=".repeat(100));
    lines.push(
      "Member".padEnd(10) +
        "Type".padEnd(12) +
        "Length(m)".padEnd(12) +
        "Axial(kN)".padEnd(14) +
        "Shear(kN)".padEnd(14) +
        "Moment(kNm)".padEnd(14) +
        "Util(%)".padEnd(10) +
        "Status".padEnd(8) +
        "Governing",
    );
    lines.push("-".repeat(100));
    for (const r of designRows) {
      lines.push(
        r.label.padEnd(10) +
          r.materialType.padEnd(12) +
          r.length.toFixed(2).padStart(8).padEnd(12) +
          fmtForce(r.maxAxial).padStart(10).padEnd(14) +
          fmtForce(r.maxShearY).padStart(10).padEnd(14) +
          fmtForce(r.maxMomentZ).padStart(10).padEnd(14) +
          (r.utilization * 100).toFixed(1).padStart(6).padEnd(10) +
          r.status.padEnd(8) +
          r.governing,
      );
    }
    lines.push("");

    // Detailed design checks per member
    for (const r of designRows) {
      lines.push("");
      lines.push(`── Member ${r.label} (${r.materialType}) ──`);
      lines.push(
        `Length: ${r.length.toFixed(3)} m | Overall: ${r.status} (${(r.utilization * 100).toFixed(1)}%)`,
      );
      for (const c of r.designResult.checks) {
        lines.push(
          `  ${c.name}: ${c.status} (${(c.utilization * 100).toFixed(1)}%) — ${c.description}`,
        );
        if (c.formula) lines.push(`    Formula: ${c.formula}`);
      }
      if (r.designResult.reinforcement) {
        const rf = r.designResult.reinforcement;
        lines.push(
          `  Reinforcement: ${rf.mainBars.count}×Ø${rf.mainBars.diameter} (${rf.mainBars.area.toFixed(0)} mm², ${rf.mainBars.ratio.toFixed(2)}%)`,
        );
        lines.push(
          `  Stirrups: Ø${rf.stirrups.diameter}@${rf.stirrups.spacing} mm c/c, ${rf.stirrups.legs}-legged`,
        );
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Design_Report_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [designRows]);

  if (!analysisResults) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No Analysis Results</DialogTitle>
            <DialogDescription>Run an analysis first to access the design studio.</DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <p className="text-[#adc6ff] mb-2">No analysis results available.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-none w-screen h-screen p-0 rounded-none flex flex-col gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Post-Processing Design Studio</DialogTitle>
        </DialogHeader>
        {/* Title Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#131b2e] border-b border-[#1a2333]/60 shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Post-Processing Design Studio
            </h2>
            <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
              {designRows.length} members
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-5 py-1.5 bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-300/40 dark:border-slate-700/40 shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium tracking-wide tracking-wide transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "summary" && (
          <SummaryTab
            rows={designRows}
            onSelectMember={setSelectedMemberId}
            selectedId={selectedMemberId}
          />
        )}
        {activeTab === "rcBeam" && (
          <RCBeamTab
            rows={designRows}
            selectedId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
          />
        )}
        {activeTab === "steel" && (
          <SteelDesignTab
            rows={designRows}
            selectedId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
          />
        )}
        {activeTab === "section" && (
          <SectionPropertiesTab members={members} nodes={nodes} />
        )}
        {activeTab === "deflection" && (
          <DeflectionCheckTab
            rows={designRows}
            analysisResults={analysisResults}
            members={members}
            nodes={nodes}
          />
        )}
      </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostProcessingDesignStudio;
