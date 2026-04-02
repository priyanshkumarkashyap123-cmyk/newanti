import { IS_SECTIONS } from '../sectionsDb.js';
import type { CodeCheckResult } from '../types.js';

export async function checkCodeCompliance(
  member: { section: string; length: number; type: 'beam' | 'column' },
  forces: { axial?: number; moment?: number; shear?: number },
  code: string = 'IS_800'
): Promise<CodeCheckResult> {
  const checks: CodeCheckResult['checks'] = [];
  const section = IS_SECTIONS[member.section];

  if (!section) {
    return {
      success: false,
      code,
      overallStatus: 'fail',
      checks: [],
      summary: `Unknown section: ${member.section}. Use IS standard sections (ISMB, ISMC, ISA).`,
    };
  }

  const fy = 250;
  const E = 200000;

  if (forces.axial && forces.axial > 0) {
    const tensionCapacity = section.A * fy * 1e-3;
    const ratio = forces.axial / tensionCapacity;
    checks.push({
      clause: 'Cl. 6.2 — Tension yielding',
      description: 'Design strength of member in tension',
      status: ratio <= 1.0 ? 'pass' : 'fail',
      ratio: parseFloat(ratio.toFixed(3)),
      limit: tensionCapacity,
      actual: forces.axial,
      details: `Td = Ag × fy / γm0 = ${tensionCapacity.toFixed(1)} kN`,
    });
  }

  if (forces.axial && forces.axial < 0) {
    const axialForce = Math.abs(forces.axial);
    const slenderness = member.length / Math.sqrt(section.Ix / section.A);
    const slendernessRatio = slenderness / (Math.PI * Math.sqrt(E / fy));

    let chi = 1.0;
    if (slendernessRatio > 0.2) {
      const alpha = 0.49;
      const phi = 0.5 * (1 + alpha * (slendernessRatio - 0.2) + slendernessRatio * slendernessRatio);
      chi = Math.min(1.0, 1.0 / (phi + Math.sqrt(phi * phi - slendernessRatio * slendernessRatio)));
    }

    const compressionCapacity = chi * section.A * fy * 1e-3;
    const ratio = axialForce / compressionCapacity;
    checks.push({
      clause: 'Cl. 7.1.2 — Compression buckling',
      description: `Buckling resistance (λ = ${slenderness.toFixed(1)})`,
      status: ratio <= 1.0 ? 'pass' : 'fail',
      ratio: parseFloat(ratio.toFixed(3)),
      limit: compressionCapacity,
      actual: axialForce,
      details: `Pd = χ × Ag × fy / γm0 = ${compressionCapacity.toFixed(1)} kN, λ = ${slenderness.toFixed(1)}`,
    });
  }

  if (forces.moment) {
    const momentCapacity = section.Zx * fy * 1e-3;
    const ratio = Math.abs(forces.moment) / momentCapacity;
    checks.push({
      clause: 'Cl. 8.2.1 — Bending strength',
      description: 'Design bending strength (elastic)',
      status: ratio <= 1.0 ? 'pass' : 'fail',
      ratio: parseFloat(ratio.toFixed(3)),
      limit: momentCapacity,
      actual: Math.abs(forces.moment),
      details: `Md = βb × Zp × fy / γm0 = ${momentCapacity.toFixed(1)} kN·m`,
    });
  }

  if (forces.shear) {
    const Av = section.A * 0.6;
    const shearCapacity = Av * fy / (Math.sqrt(3)) * 1e-3;
    const ratio = Math.abs(forces.shear) / shearCapacity;
    checks.push({
      clause: 'Cl. 8.4 — Shear strength',
      description: 'Design shear strength',
      status: ratio <= 1.0 ? 'pass' : 'fail',
      ratio: parseFloat(ratio.toFixed(3)),
      limit: shearCapacity,
      actual: Math.abs(forces.shear),
      details: `Vd = Av × fy / (√3 × γm0) = ${shearCapacity.toFixed(1)} kN`,
    });
  }

  if (member.type === 'beam' && forces.moment) {
    const deflectionLimit = member.length * 1000 / 300;
    const estimatedDeflection = (5 * Math.abs(forces.moment) * member.length * member.length) / (48 * E * section.Ix) * 1000;
    const ratio = estimatedDeflection / deflectionLimit;
    checks.push({
      clause: 'Table 6 — Deflection limit',
      description: `Serviceability deflection check (L/300 = ${deflectionLimit.toFixed(1)} mm)`,
      status: ratio <= 1.0 ? 'pass' : 'fail',
      ratio: parseFloat(ratio.toFixed(3)),
      limit: deflectionLimit,
      actual: estimatedDeflection,
      details: `δ = ${estimatedDeflection.toFixed(2)} mm vs limit = ${deflectionLimit.toFixed(1)} mm`,
    });
  }

  if (forces.axial && forces.moment) {
    const axialCapacity = section.A * fy * 1e-3;
    const momentCapacity = section.Zx * fy * 1e-3;
    const combinedRatio = Math.abs(forces.axial) / axialCapacity + Math.abs(forces.moment) / momentCapacity;
    checks.push({
      clause: 'Cl. 9.3.1 — Combined axial + bending',
      description: 'Interaction ratio for combined forces',
      status: combinedRatio <= 1.0 ? 'pass' : 'fail',
      ratio: parseFloat(combinedRatio.toFixed(3)),
      limit: 1.0,
      actual: combinedRatio,
      details: `N/Nd + M/Md = ${combinedRatio.toFixed(3)} ≤ 1.0`,
    });
  }

  const failCount = checks.filter(c => c.status === 'fail').length;
  const overallStatus: 'pass' | 'fail' | 'warning' =
    failCount > 0 ? 'fail' : checks.some(c => c.ratio && c.ratio > 0.85) ? 'warning' : 'pass';

  return {
    success: true,
    code,
    overallStatus,
    checks,
    summary: failCount === 0
      ? `✅ All ${checks.length} checks passed for ${member.section} under ${code}.`
      : `❌ ${failCount}/${checks.length} checks failed for ${member.section}. Consider upgrading the section.`,
  };
}