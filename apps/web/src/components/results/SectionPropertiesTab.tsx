/**
 * SectionPropertiesTab — Expandable section properties table (A, I, Z, r, J)
 * with geometric, dimensional, and material details per member.
 * Extracted from PostProcessingDesignStudio for modularity.
 */

import React, { FC, useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Box,
  CircleDot,
  Grid3X3,
  Minus,
  Plus,
} from "lucide-react";
import type { Member } from "../../store/model";
import { memberLength } from "./postProcessingTypes";

interface SectionPropertiesTabProps {
  members: Map<string, Member>;
  nodes: Map<string, { x: number; y: number; z?: number }>;
}

const SectionPropertiesTab: FC<SectionPropertiesTabProps> = ({
  members,
  nodes,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const memberList = useMemo(() => {
    const list: { id: string; m: Member; length: number }[] = [];
    members.forEach((m, id) => {
      list.push({ id, m, length: memberLength(m, nodes) });
    });
    return list;
  }, [members, nodes]);

  const sectionIcon = (type?: string) => {
    switch (type) {
      case "I-BEAM":
        return <Columns3 className="w-4 h-4 text-blue-400" />;
      case "RECTANGLE":
        return <Box className="w-4 h-4 text-amber-400" />;
      case "CIRCLE":
        return <CircleDot className="w-4 h-4 text-green-400" />;
      case "TUBE":
        return <Grid3X3 className="w-4 h-4 text-purple-400" />;
      case "C-CHANNEL":
        return <Minus className="w-4 h-4 text-cyan-400" />;
      case "L-ANGLE":
        return <Plus className="w-4 h-4 text-orange-400" />;
      default:
        return <Box className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-8"></th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Member
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Section
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Length (m)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              A (m²)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              I<sub>z</sub> (m⁴)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              I<sub>y</sub> (m⁴)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              J (m⁴)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              E (kN/m²)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {memberList.map(({ id, m, length }) => {
            const isExpanded = expandedId === id;
            return (
              <Fragment key={id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                  className="cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="px-3 py-2.5 text-slate-500">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-medium text-slate-800 dark:text-slate-200">
                    M{id}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {sectionIcon(m.sectionType)}
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={m.sectionType ?? "Default"}>
                        {m.sectionType ?? "Default"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {length.toFixed(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.A ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.I ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.Iy ?? m.I ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.J ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.E ?? 200e6).toExponential(2)}
                  </td>
                </tr>
                {/* Expanded detail row */}
                {isExpanded && (
                  <tr className="bg-slate-100/40 dark:bg-slate-800/40">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-3 gap-6">
                        {/* Geometric Properties */}
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                            Geometric Properties
                          </h5>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Area (A)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.A ?? 0).toExponential(4)} m²
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                I<sub>z</sub> (Major)
                              </span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.I ?? 0).toExponential(4)} m⁴
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                I<sub>y</sub> (Minor)
                              </span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.Iy ?? m.I ?? 0).toExponential(4)} m⁴
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">J (Torsion)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.J ?? 0).toExponential(4)} m⁴
                              </span>
                            </div>
                            {m.A && m.I ? (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    r<sub>z</sub> (Gyration)
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {(Math.sqrt(m.I / m.A) * 1000).toFixed(1)}{" "}
                                    mm
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Z<sub>z</sub> (Elastic)
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {(() => {
                                      const d = m.dimensions;
                                      const depth =
                                        d?.height ??
                                        d?.rectHeight ??
                                        d?.diameter ??
                                        Math.sqrt(
                                          (12 * (m.I ?? 1)) / (m.A ?? 1),
                                        ) * 1000;
                                      return (
                                        (m.I ?? 0) /
                                        (depth / 2 / 1000)
                                      ).toExponential(3);
                                    })()}{" "}
                                    m³
                                  </span>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Section Dimensions */}
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                            Section Dimensions
                          </h5>
                          {m.dimensions ? (
                            <div className="space-y-1.5 text-sm">
                              {m.dimensions.height != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Height</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.height} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.width != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Width</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.width} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.webThickness != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Web t<sub>w</sub>
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.webThickness} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.flangeThickness != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Flange t<sub>f</sub>
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.flangeThickness} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.rectWidth != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Width b</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.rectWidth} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.rectHeight != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Depth d</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.rectHeight} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.diameter != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Diameter
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.diameter} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.thickness != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Thickness
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.thickness} mm
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">
                              No explicit dimensions set — using computed A, I.
                            </p>
                          )}
                        </div>

                        {/* Material Properties */}
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                            Material Properties
                          </h5>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Material</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200 capitalize">
                                {(m.E ?? 200e6) < 50e6 ? "concrete" : "steel"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">E (Elastic)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {((m.E ?? 200e6) / 1e6).toFixed(0)} GPa
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">G (Shear)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {((m.G ?? 77e6) / 1e6).toFixed(0)} GPa
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">ρ (Density)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {m.rho ?? 7850} kg/m³
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                β (Rotation)
                              </span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {m.betaAngle ?? 0}°
                              </span>
                            </div>
                            {m.releases && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Releases</span>
                                <span className="font-mono text-amber-400 text-xs">
                                  {[
                                    m.releases.startMoment && "Mz-start",
                                    m.releases.endMoment && "Mz-end",
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "None"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

SectionPropertiesTab.displayName = "SectionPropertiesTab";

export default React.memo(SectionPropertiesTab);
