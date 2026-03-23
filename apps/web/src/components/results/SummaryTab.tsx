/**
 * SummaryTab — Member design summary table with sorting, filtering, and KPI banner.
 * Extracted from PostProcessingDesignStudio for modularity.
 */

import React, { FC, useState, useMemo } from "react";
import {
  ArrowUpDown,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  type MemberDesignRow,
  type SortKey,
  statusColors,
  utilizationColor,
  utilizationTextColor,
  fmtForce,
} from "./postProcessingTypes";

interface SummaryTabProps {
  rows: MemberDesignRow[];
  onSelectMember: (id: string) => void;
  selectedId: string | null;
}

const SummaryTab: FC<SummaryTabProps> = ({
  rows,
  onSelectMember,
  selectedId,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("utilization");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "PASS" | "FAIL" | "WARNING"
  >("all");

  const sorted = useMemo(() => {
    let filtered = rows;
    if (filterText) {
      const lc = filterText.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.id.toLowerCase().includes(lc) || r.label.toLowerCase().includes(lc),
      );
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortKey) {
        case "id":
          va = a.id;
          vb = b.id;
          break;
        case "length":
          va = a.length;
          vb = b.length;
          break;
        case "utilization":
          va = a.utilization;
          vb = b.utilization;
          break;
        case "maxMomentZ":
          va = Math.abs(a.maxMomentZ);
          vb = Math.abs(b.maxMomentZ);
          break;
        case "maxShearY":
          va = Math.abs(a.maxShearY);
          vb = Math.abs(b.maxShearY);
          break;
        case "maxAxial":
          va = Math.abs(a.maxAxial);
          vb = Math.abs(b.maxAxial);
          break;
      }
      if (typeof va === "string" && typeof vb === "string")
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return copy;
  }, [rows, sortKey, sortAsc, filterText, filterStatus]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const passCount = rows.filter((r) => r.status === "PASS").length;
  const failCount = rows.filter((r) => r.status === "FAIL").length;
  const warnCount = rows.filter((r) => r.status === "WARNING").length;

  const SortHeader: FC<{ label: string; k: SortKey; className?: string }> = ({
    label,
    k,
    className,
  }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:text-slate-200 select-none whitespace-nowrap ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* KPI Banner */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-300/60 dark:border-slate-700/60 bg-slate-100/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${statusColors.PASS.dot}`}
          />
          <span className="text-sm text-[#adc6ff]">{passCount} Pass</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${statusColors.WARNING.dot}`}
          />
          <span className="text-sm text-[#adc6ff]">{warnCount} Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${statusColors.FAIL.dot}`}
          />
          <span className="text-sm text-[#adc6ff]">{failCount} Fail</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-[#869ab8]">
          <span>{rows.length} members</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-slate-300/40 dark:border-slate-700/40 bg-slate-100/30 dark:bg-slate-800/30">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search members..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[#0b1326] border border-[#1a2333] rounded-md text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="text-sm bg-[#0b1326] border border-[#1a2333] rounded-md px-2 py-1.5 text-[#adc6ff]"
        >
          <option value="all">All Statuses</option>
          <option value="PASS">Pass Only</option>
          <option value="FAIL">Fail Only</option>
          <option value="WARNING">Warnings</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#131b2e] z-10">
            <tr>
              <SortHeader label="Member" k="id" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
                Type
              </th>
              <SortHeader label="Length (m)" k="length" />
              <SortHeader label="Axial (kN)" k="maxAxial" />
              <SortHeader label="Shear (kN)" k="maxShearY" />
              <SortHeader label="Moment (kN·m)" k="maxMomentZ" />
              <SortHeader
                label="Utilization"
                k="utilization"
                className="min-w-[160px]"
              />
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
                Governing
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sorted.map((row) => {
              const sc = statusColors[row.status];
              const isSelected = selectedId === row.id;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectMember(row.id)}
                  className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-100/30 dark:bg-blue-900/30 border-l-2 border-l-blue-500" : "hover:bg-slate-100/60 dark:hover:bg-slate-800/60"}`}
                >
                  <td className="px-3 py-2.5 font-mono font-medium tracking-wide text-slate-800 dark:text-slate-200">
                    {row.label}
                  </td>
                  <td className="px-3 py-2.5 text-[#869ab8] capitalize">
                    {row.materialType}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#adc6ff]">
                    {row.length.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#adc6ff]">
                    {fmtForce(row.maxAxial)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#adc6ff]">
                    {fmtForce(row.maxShearY)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#adc6ff]">
                    {fmtForce(row.maxMomentZ)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${utilizationColor(row.utilization)}`}
                          style={{
                            width: `${Math.min(row.utilization * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(row.utilization)}`}
                      >
                        {(row.utilization * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${sc.bg} ${sc.text}`}
                    >
                      {row.status === "PASS" ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : row.status === "FAIL" ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#869ab8] max-w-[120px] truncate">
                    {row.governing}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-sm">
            No members match the filters.
          </div>
        )}
      </div>
    </div>
  );
};

SummaryTab.displayName = "SummaryTab";

export default React.memo(SummaryTab);
