/**
 * ============================================================================
 * REPORT GENERATOR - PHASE 2
 * ============================================================================
 * 
 * Generates professional engineering reports with:
 * - Clause-by-clause citations
 * - Calculation summaries
 * - DCR (Demand/Capacity Ratio) tables
 * - Export to PDF/Word placeholders
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ReportSection {
  id: string;
  title: string;
  content: ReportContent[];
  subsections?: ReportSection[];
}

export type ReportContent =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'equation'; latex: string; description?: string }
  | { type: 'figure'; src: string; caption: string; width?: number }
  | { type: 'clause'; code: string; clause: string; description: string }
  | { type: 'dcr'; name: string; demand: number; capacity: number; unit: string; limit?: number }
  | { type: 'warning'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean };

export interface ReportMetadata {
  title: string;
  projectName: string;
  projectNumber?: string;
  client?: string;
  author: string;
  reviewer?: string;
  date: string;
  revision: string;
  designCodes: string[];
  software: string;
  softwareVersion: string;
  disclaimer: string;
}

export interface CalculationReport {
  metadata: ReportMetadata;
  sections: ReportSection[];
  references: Reference[];
  appendices?: ReportSection[];
}

export interface Reference {
  code: string;
  title: string;
  year: number;
  publisher: string;
}

// ============================================================================
// DESIGN CODE REFERENCES
// ============================================================================

export const DESIGN_CODE_REFERENCES: Record<string, Reference> = {
  'IS456': {
    code: 'IS 456',
    title: 'Plain and Reinforced Concrete - Code of Practice',
    year: 2000,
    publisher: 'Bureau of Indian Standards',
  },
  'IS1893': {
    code: 'IS 1893',
    title: 'Criteria for Earthquake Resistant Design of Structures',
    year: 2016,
    publisher: 'Bureau of Indian Standards',
  },
  'IS800': {
    code: 'IS 800',
    title: 'General Construction in Steel - Code of Practice',
    year: 2007,
    publisher: 'Bureau of Indian Standards',
  },
  'AISC360': {
    code: 'AISC 360',
    title: 'Specification for Structural Steel Buildings',
    year: 2022,
    publisher: 'American Institute of Steel Construction',
  },
  'ACI318': {
    code: 'ACI 318',
    title: 'Building Code Requirements for Structural Concrete',
    year: 2019,
    publisher: 'American Concrete Institute',
  },
  'ASCE7': {
    code: 'ASCE 7',
    title: 'Minimum Design Loads and Associated Criteria for Buildings',
    year: 2022,
    publisher: 'American Society of Civil Engineers',
  },
  'EN1992': {
    code: 'Eurocode 2',
    title: 'Design of Concrete Structures',
    year: 2004,
    publisher: 'European Committee for Standardization',
  },
  'EN1993': {
    code: 'Eurocode 3',
    title: 'Design of Steel Structures',
    year: 2005,
    publisher: 'European Committee for Standardization',
  },
  'EN1998': {
    code: 'Eurocode 8',
    title: 'Design of Structures for Earthquake Resistance',
    year: 2004,
    publisher: 'European Committee for Standardization',
  },
  'DNVGL': {
    code: 'DNV-GL',
    title: 'Offshore Wind Turbine Structures',
    year: 2019,
    publisher: 'DNV GL',
  },
};

// ============================================================================
// CLAUSE CITATION BUILDER
// ============================================================================

export interface ClauseCitation {
  code: string;
  clause: string;
  title: string;
  requirement: string;
  status: 'SATISFIED' | 'NOT_SATISFIED' | 'N/A';
  notes?: string;
}

export function buildClauseCitation(
  code: string,
  clause: string,
  title: string,
  requirement: string,
  status: 'SATISFIED' | 'NOT_SATISFIED' | 'N/A',
  notes?: string
): ClauseCitation {
  return { code, clause, title, requirement, status, notes };
}

export function formatClauseTable(citations: ClauseCitation[]): ReportContent {
  return {
    type: 'table',
    headers: ['Code', 'Clause', 'Requirement', 'Status', 'Notes'],
    rows: citations.map((c) => [
      c.code,
      c.clause,
      c.requirement,
      c.status,
      c.notes || '-',
    ]),
    caption: 'Design Code Compliance Summary',
  };
}

// ============================================================================
// DCR (DEMAND/CAPACITY RATIO) GENERATOR
// ============================================================================

export interface DCREntry {
  check: string;
  demand: number;
  capacity: number;
  unit: string;
  dcr: number;
  status: 'PASS' | 'FAIL' | 'MARGINAL';
  clause?: string;
}

export function calculateDCR(demand: number, capacity: number, limit: number = 1.0): DCREntry['status'] {
  const dcr = demand / capacity;
  if (dcr > limit) return 'FAIL';
  if (dcr > limit * 0.9) return 'MARGINAL';
  return 'PASS';
}

export function buildDCRTable(entries: Omit<DCREntry, 'dcr' | 'status'>[]): DCREntry[] {
  return entries.map((e) => {
    const dcr = e.demand / e.capacity;
    return {
      ...e,
      dcr: Math.round(dcr * 1000) / 1000,
      status: calculateDCR(e.demand, e.capacity),
    };
  });
}

export function formatDCRTable(entries: DCREntry[]): ReportContent {
  return {
    type: 'table',
    headers: ['Check', 'Demand', 'Capacity', 'Unit', 'DCR', 'Status', 'Clause'],
    rows: entries.map((e) => [
      e.check,
      e.demand.toFixed(2),
      e.capacity.toFixed(2),
      e.unit,
      e.dcr.toFixed(3),
      e.status,
      e.clause || '-',
    ]),
    caption: 'Demand/Capacity Ratio Summary',
  };
}

// ============================================================================
// REPORT BUILDER
// ============================================================================

export class ReportBuilder {
  private metadata: ReportMetadata;
  private sections: ReportSection[] = [];
  private references: Set<string> = new Set();

  constructor(metadata: Partial<ReportMetadata> & { title: string; projectName: string }) {
    this.metadata = {
      title: metadata.title,
      projectName: metadata.projectName,
      projectNumber: metadata.projectNumber || '',
      client: metadata.client || '',
      author: metadata.author || 'BeamLab',
      reviewer: metadata.reviewer || '',
      date: metadata.date || new Date().toISOString().split('T')[0],
      revision: metadata.revision || 'R0',
      designCodes: metadata.designCodes || [],
      software: 'BeamLab',
      softwareVersion: '4.1.0',
      disclaimer: metadata.disclaimer || 
        'This calculation is for engineering decision support only. ' +
        'Results must be reviewed and stamped by a licensed Professional Engineer (PE/SE) ' +
        'before use in construction documents.',
    };
  }

  addSection(section: ReportSection): this {
    this.sections.push(section);
    return this;
  }

  addReference(codeKey: string): this {
    this.references.add(codeKey);
    return this;
  }

  addClauseCitation(
    sectionId: string,
    code: string,
    clause: string,
    description: string
  ): this {
    const section = this.findSection(sectionId);
    if (section) {
      section.content.push({
        type: 'clause',
        code,
        clause,
        description,
      });
      // Auto-add to references
      const codeKey = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (DESIGN_CODE_REFERENCES[codeKey]) {
        this.references.add(codeKey);
      }
    }
    return this;
  }

  addDCRCheck(
    sectionId: string,
    name: string,
    demand: number,
    capacity: number,
    unit: string,
    limit?: number
  ): this {
    const section = this.findSection(sectionId);
    if (section) {
      section.content.push({
        type: 'dcr',
        name,
        demand,
        capacity,
        unit,
        limit,
      });
    }
    return this;
  }

  addWarning(sectionId: string, text: string): this {
    const section = this.findSection(sectionId);
    if (section) {
      section.content.push({ type: 'warning', text });
    }
    return this;
  }

  private findSection(id: string): ReportSection | undefined {
    const search = (sections: ReportSection[]): ReportSection | undefined => {
      for (const s of sections) {
        if (s.id === id) return s;
        if (s.subsections) {
          const found = search(s.subsections);
          if (found) return found;
        }
      }
      return undefined;
    };
    return search(this.sections);
  }

  build(): CalculationReport {
    return {
      metadata: this.metadata,
      sections: this.sections,
      references: Array.from(this.references)
        .map((key) => DESIGN_CODE_REFERENCES[key])
        .filter(Boolean),
    };
  }

  toMarkdown(): string {
    const report = this.build();
    let md = '';

    // Title page
    md += `# ${report.metadata.title}\n\n`;
    md += `**Project:** ${report.metadata.projectName}`;
    if (report.metadata.projectNumber) md += ` (${report.metadata.projectNumber})`;
    md += '\n\n';
    if (report.metadata.client) md += `**Client:** ${report.metadata.client}\n\n`;
    md += `**Date:** ${report.metadata.date} | **Revision:** ${report.metadata.revision}\n\n`;
    md += `**Author:** ${report.metadata.author}`;
    if (report.metadata.reviewer) md += ` | **Reviewer:** ${report.metadata.reviewer}`;
    md += '\n\n';
    md += `**Software:** ${report.metadata.software} v${report.metadata.softwareVersion}\n\n`;
    md += `---\n\n`;
    md += `> ⚠️ **DISCLAIMER:** ${report.metadata.disclaimer}\n\n`;
    md += `---\n\n`;

    // Design codes
    if (report.metadata.designCodes.length > 0) {
      md += `## Design Codes\n\n`;
      md += report.metadata.designCodes.map(c => `- ${c}`).join('\n') + '\n\n';
    }

    // Sections
    const renderSection = (section: ReportSection, level: number): string => {
      let sectionMd = `${'#'.repeat(level)} ${section.title}\n\n`;
      
      for (const content of section.content) {
        switch (content.type) {
          case 'paragraph':
            sectionMd += `${content.text}\n\n`;
            break;
          case 'heading':
            sectionMd += `${'#'.repeat(content.level + level)} ${content.text}\n\n`;
            break;
          case 'table':
            if (content.caption) sectionMd += `**${content.caption}**\n\n`;
            sectionMd += '| ' + content.headers.join(' | ') + ' |\n';
            sectionMd += '| ' + content.headers.map(() => '---').join(' | ') + ' |\n';
            for (const row of content.rows) {
              sectionMd += '| ' + row.join(' | ') + ' |\n';
            }
            sectionMd += '\n';
            break;
          case 'equation':
            sectionMd += `$$${content.latex}$$\n\n`;
            if (content.description) sectionMd += `*${content.description}*\n\n`;
            break;
          case 'clause':
            sectionMd += `📋 **${content.code} ${content.clause}:** ${content.description}\n\n`;
            break;
          case 'dcr':
            const dcr = content.demand / content.capacity;
            const status = dcr > (content.limit || 1) ? '❌ FAIL' : dcr > 0.9 ? '⚠️ MARGINAL' : '✅ PASS';
            sectionMd += `- **${content.name}:** ${content.demand}/${content.capacity} ${content.unit} = **${dcr.toFixed(3)}** ${status}\n`;
            break;
          case 'warning':
            sectionMd += `> ⚠️ **WARNING:** ${content.text}\n\n`;
            break;
          case 'list':
            sectionMd += content.items.map((item, i) => 
              content.ordered ? `${i + 1}. ${item}` : `- ${item}`
            ).join('\n') + '\n\n';
            break;
          case 'figure':
            sectionMd += `![${content.caption}](${content.src})\n\n*${content.caption}*\n\n`;
            break;
        }
      }

      if (section.subsections) {
        for (const sub of section.subsections) {
          sectionMd += renderSection(sub, level + 1);
        }
      }

      return sectionMd;
    };

    for (const section of report.sections) {
      md += renderSection(section, 2);
    }

    // References
    if (report.references.length > 0) {
      md += `## References\n\n`;
      for (const ref of report.references) {
        md += `- ${ref.code} (${ref.year}). *${ref.title}*. ${ref.publisher}.\n`;
      }
      md += '\n';
    }

    return md;
  }

  toHTML(): string {
    // Placeholder for HTML export
    const md = this.toMarkdown();
    // In production, use a Markdown-to-HTML library
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.metadata.title}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    blockquote { border-left: 4px solid #f0ad4e; padding-left: 1em; color: #856404; background: #fff3cd; margin: 1em 0; padding: 1em; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
    .dcr-pass { color: green; } .dcr-fail { color: red; } .dcr-marginal { color: orange; }
  </style>
</head>
<body>
<pre>${md.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
  }
}

// ============================================================================
// PRESET REPORT TEMPLATES
// ============================================================================

export function createBeamDesignReport(
  projectName: string,
  beamData: {
    id: string;
    span: number;
    width: number;
    depth: number;
    fc: number;
    fy: number;
    loads: { type: string; value: number; unit: string }[];
    results: { check: string; demand: number; capacity: number; unit: string; clause: string }[];
  }
): ReportBuilder {
  const builder = new ReportBuilder({
    title: `Beam Design Calculation - ${beamData.id}`,
    projectName,
    designCodes: ['IS 456:2000', 'IS 875:2015'],
  });

  builder.addSection({
    id: 'geometry',
    title: 'Beam Geometry & Materials',
    content: [
      { type: 'paragraph', text: `This section presents the design of beam ${beamData.id}.` },
      {
        type: 'table',
        headers: ['Property', 'Value', 'Unit'],
        rows: [
          ['Span', beamData.span.toString(), 'm'],
          ['Width', beamData.width.toString(), 'mm'],
          ['Depth', beamData.depth.toString(), 'mm'],
          ['Concrete Grade', `M${beamData.fc}`, 'MPa'],
          ['Steel Grade', `Fe${beamData.fy}`, 'MPa'],
        ],
        caption: 'Beam Properties',
      },
    ],
  });

  builder.addSection({
    id: 'loads',
    title: 'Load Summary',
    content: [
      {
        type: 'table',
        headers: ['Load Type', 'Value', 'Unit'],
        rows: beamData.loads.map((l) => [l.type, l.value.toString(), l.unit]),
        caption: 'Applied Loads',
      },
      {
        type: 'clause',
        code: 'IS 456',
        clause: 'Cl. 36.1',
        description: 'Load combinations as per Table 18',
      },
    ],
  });

  const dcrEntries = buildDCRTable(beamData.results);
  builder.addSection({
    id: 'results',
    title: 'Design Results',
    content: [formatDCRTable(dcrEntries)],
  });

  builder.addReference('IS456');
  
  return builder;
}
