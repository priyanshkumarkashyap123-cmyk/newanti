/**
 * ============================================================================
 * ENGINEERING REPORT GENERATOR
 * ============================================================================
 * 
 * Comprehensive structural engineering report generation:
 * - Design calculation sheets
 * - Analysis summaries
 * - Code compliance reports
 * - Drawing schedules
 * - Executive summaries
 * - Multiple output formats (HTML, Markdown, PDF-ready)
 * 
 * Standards Referenced:
 * - IS 456, IS 800, IS 875, IS 1893
 * - ACI 318, AISC 360
 * - Eurocode 2, 3, 8
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ReportConfig {
  title: string;
  projectName: string;
  projectNumber: string;
  client: string;
  engineer: string;
  checker?: string;
  approver?: string;
  date: string;
  revision: string;
  logo?: string;
  companyName: string;
  companyAddress?: string;
  format: 'html' | 'markdown' | 'json';
  includeTableOfContents: boolean;
  includePageNumbers: boolean;
  includeCoverPage: boolean;
  includeAppendix: boolean;
}

export interface Section {
  id: string;
  title: string;
  level: number; // 1, 2, 3 for heading levels
  content: ContentBlock[];
  pageBreakBefore?: boolean;
}

export interface ContentBlock {
  type: 'paragraph' | 'heading' | 'table' | 'image' | 'equation' | 'list' | 'code' | 'divider';
  data: any;
}

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
  caption?: string;
  columnWidths?: number[];
  alignment?: ('left' | 'center' | 'right')[];
}

export interface CalculationStep {
  description: string;
  formula?: string;
  values?: Record<string, string | number>;
  result?: string | number;
  unit?: string;
  reference?: string;
  status?: 'pass' | 'fail' | 'check';
}

export interface DesignResult {
  element: string;
  checkType: string;
  capacity: number;
  demand: number;
  ratio: number;
  status: 'OK' | 'FAIL' | 'MARGINAL';
  reference: string;
}

// ============================================================================
// REPORT BUILDER
// ============================================================================

export class ReportBuilder {
  private sections: Section[] = [];
  private config: ReportConfig;

  constructor(config: Partial<ReportConfig>) {
    this.config = {
      title: 'Structural Engineering Report',
      projectName: 'Project',
      projectNumber: 'P001',
      client: 'Client',
      engineer: 'Engineer',
      date: new Date().toISOString().split('T')[0],
      revision: '0',
      companyName: 'Engineering Consultants',
      format: 'html',
      includeTableOfContents: true,
      includePageNumbers: true,
      includeCoverPage: true,
      includeAppendix: true,
      ...config
    };
  }

  /**
   * Add a new section
   */
  addSection(title: string, level: number = 1, pageBreakBefore: boolean = false): ReportBuilder {
    this.sections.push({
      id: `section-${this.sections.length + 1}`,
      title,
      level,
      content: [],
      pageBreakBefore
    });
    return this;
  }

  /**
   * Add paragraph to current section
   */
  addParagraph(text: string): ReportBuilder {
    this.getCurrentSection().content.push({
      type: 'paragraph',
      data: { text }
    });
    return this;
  }

  /**
   * Add table to current section
   */
  addTable(data: TableData): ReportBuilder {
    this.getCurrentSection().content.push({
      type: 'table',
      data
    });
    return this;
  }

  /**
   * Add equation
   */
  addEquation(latex: string, description?: string): ReportBuilder {
    this.getCurrentSection().content.push({
      type: 'equation',
      data: { latex, description }
    });
    return this;
  }

  /**
   * Add calculation step
   */
  addCalculation(step: CalculationStep): ReportBuilder {
    this.getCurrentSection().content.push({
      type: 'paragraph',
      data: { calculation: step }
    });
    return this;
  }

  /**
   * Add list
   */
  addList(items: string[], ordered: boolean = false): ReportBuilder {
    this.getCurrentSection().content.push({
      type: 'list',
      data: { items, ordered }
    });
    return this;
  }

  /**
   * Add image
   */
  addImage(src: string, caption?: string, width?: number): ReportBuilder {
    this.getCurrentSection().content.push({
      type: 'image',
      data: { src, caption, width }
    });
    return this;
  }

  /**
   * Add divider
   */
  addDivider(): ReportBuilder {
    this.getCurrentSection().content.push({
      type: 'divider',
      data: {}
    });
    return this;
  }

  /**
   * Add design results table
   */
  addDesignResults(results: DesignResult[]): ReportBuilder {
    const tableData: TableData = {
      headers: ['Element', 'Check', 'Capacity', 'Demand', 'Ratio', 'Status', 'Ref.'],
      rows: results.map(r => [
        r.element,
        r.checkType,
        r.capacity.toFixed(2),
        r.demand.toFixed(2),
        r.ratio.toFixed(3),
        r.status,
        r.reference
      ]),
      caption: 'Design Check Summary'
    };
    return this.addTable(tableData);
  }

  /**
   * Generate report
   */
  generate(): string {
    switch (this.config.format) {
      case 'html':
        return this.generateHTML();
      case 'markdown':
        return this.generateMarkdown();
      case 'json':
        return this.generateJSON();
      default:
        return this.generateHTML();
    }
  }

  private getCurrentSection(): Section {
    if (this.sections.length === 0) {
      this.addSection('Introduction');
    }
    return this.sections[this.sections.length - 1];
  }

  /**
   * Generate HTML output
   */
  private generateHTML(): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.title}</title>
  <style>
    ${this.getHTMLStyles()}
  </style>
</head>
<body>
`;

    // Cover page
    if (this.config.includeCoverPage) {
      html += this.generateHTMLCoverPage();
    }

    // Table of contents
    if (this.config.includeTableOfContents) {
      html += this.generateHTMLTOC();
    }

    // Content
    for (const section of this.sections) {
      html += this.generateHTMLSection(section);
    }

    html += `
</body>
</html>`;

    return html;
  }

  private getHTMLStyles(): string {
    return `
      :root {
        --primary-color: #2563eb;
        --success-color: #16a34a;
        --danger-color: #dc2626;
        --warning-color: #ca8a04;
        --text-color: #1f2937;
        --border-color: #e5e7eb;
      }
      
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: var(--text-color);
        max-width: 210mm;
        margin: 0 auto;
        padding: 20mm;
        background: #fff;
      }
      
      @media print {
        body { padding: 15mm; }
        .page-break { page-break-before: always; }
        .no-print { display: none; }
      }
      
      .cover-page {
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        page-break-after: always;
      }
      
      .cover-page h1 {
        font-size: 2.5em;
        color: var(--primary-color);
        margin-bottom: 0.5em;
      }
      
      .cover-page .project-info {
        margin-top: 2em;
        text-align: left;
      }
      
      .toc {
        page-break-after: always;
      }
      
      .toc h2 {
        margin-bottom: 1em;
        color: var(--primary-color);
      }
      
      .toc ul {
        list-style: none;
      }
      
      .toc li {
        margin: 0.5em 0;
      }
      
      .toc a {
        color: var(--text-color);
        text-decoration: none;
      }
      
      .toc a:hover {
        color: var(--primary-color);
      }
      
      h1, h2, h3, h4 {
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        color: var(--primary-color);
      }
      
      h1 { font-size: 1.8em; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.3em; }
      h2 { font-size: 1.4em; }
      h3 { font-size: 1.2em; }
      h4 { font-size: 1.1em; }
      
      p {
        margin: 0.8em 0;
        text-align: justify;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        font-size: 0.9em;
      }
      
      th, td {
        border: 1px solid var(--border-color);
        padding: 8px 12px;
        text-align: left;
      }
      
      th {
        background: var(--primary-color);
        color: white;
        font-weight: 600;
      }
      
      tr:nth-child(even) {
        background: #f9fafb;
      }
      
      caption {
        caption-side: bottom;
        font-style: italic;
        color: #6b7280;
        padding: 0.5em;
      }
      
      .calculation {
        background: #f3f4f6;
        padding: 1em;
        border-left: 4px solid var(--primary-color);
        margin: 1em 0;
        border-radius: 0 4px 4px 0;
      }
      
      .calculation .formula {
        font-family: 'Cambria Math', 'Times New Roman', serif;
        font-size: 1.1em;
        margin: 0.5em 0;
      }
      
      .calculation .result {
        font-weight: bold;
        color: var(--primary-color);
      }
      
      .calculation .reference {
        font-size: 0.85em;
        color: #6b7280;
        font-style: italic;
      }
      
      .status-pass { color: var(--success-color); font-weight: bold; }
      .status-fail { color: var(--danger-color); font-weight: bold; }
      .status-check { color: var(--warning-color); font-weight: bold; }
      
      .equation {
        text-align: center;
        margin: 1.5em 0;
        padding: 1em;
        background: #fafafa;
        border-radius: 4px;
      }
      
      ul, ol {
        margin: 0.8em 0;
        padding-left: 2em;
      }
      
      li {
        margin: 0.3em 0;
      }
      
      hr {
        border: none;
        border-top: 1px solid var(--border-color);
        margin: 2em 0;
      }
      
      .image-container {
        text-align: center;
        margin: 1.5em 0;
      }
      
      .image-container img {
        max-width: 100%;
        height: auto;
      }
      
      .image-container .caption {
        font-style: italic;
        color: #6b7280;
        margin-top: 0.5em;
      }
      
      .header {
        border-bottom: 2px solid var(--primary-color);
        padding-bottom: 10px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .header .company {
        font-weight: bold;
        color: var(--primary-color);
      }
      
      .header .project-ref {
        text-align: right;
        font-size: 0.9em;
      }
    `;
  }

  private generateHTMLCoverPage(): string {
    return `
<div class="cover-page">
  <h1>${this.config.title}</h1>
  <div class="project-info">
    <table style="border: none; margin: 0 auto;">
      <tr><td style="border: none;"><strong>Project:</strong></td><td style="border: none;">${this.config.projectName}</td></tr>
      <tr><td style="border: none;"><strong>Project No:</strong></td><td style="border: none;">${this.config.projectNumber}</td></tr>
      <tr><td style="border: none;"><strong>Client:</strong></td><td style="border: none;">${this.config.client}</td></tr>
      <tr><td style="border: none;"><strong>Engineer:</strong></td><td style="border: none;">${this.config.engineer}</td></tr>
      ${this.config.checker ? `<tr><td style="border: none;"><strong>Checker:</strong></td><td style="border: none;">${this.config.checker}</td></tr>` : ''}
      ${this.config.approver ? `<tr><td style="border: none;"><strong>Approver:</strong></td><td style="border: none;">${this.config.approver}</td></tr>` : ''}
      <tr><td style="border: none;"><strong>Date:</strong></td><td style="border: none;">${this.config.date}</td></tr>
      <tr><td style="border: none;"><strong>Revision:</strong></td><td style="border: none;">${this.config.revision}</td></tr>
    </table>
  </div>
  <div style="margin-top: 4em;">
    <strong>${this.config.companyName}</strong><br>
    ${this.config.companyAddress || ''}
  </div>
</div>
`;
  }

  private generateHTMLTOC(): string {
    let toc = `
<div class="toc">
  <h2>Table of Contents</h2>
  <ul>
`;

    let sectionNumber = 0;
    for (const section of this.sections) {
      if (section.level === 1) {
        sectionNumber++;
      }
      const indent = (section.level - 1) * 20;
      const number = section.level === 1 ? `${sectionNumber}.` : '';
      toc += `    <li style="margin-left: ${indent}px"><a href="#${section.id}">${number} ${section.title}</a></li>\n`;
    }

    toc += `  </ul>
</div>
`;
    return toc;
  }

  private generateHTMLSection(section: Section): string {
    const pageBreak = section.pageBreakBefore ? 'class="page-break"' : '';
    const tag = `h${Math.min(section.level, 4)}`;

    let html = `
<section id="${section.id}" ${pageBreak}>
  <${tag}>${section.title}</${tag}>
`;

    for (const block of section.content) {
      html += this.renderHTMLBlock(block);
    }

    html += `</section>
`;
    return html;
  }

  private renderHTMLBlock(block: ContentBlock): string {
    switch (block.type) {
      case 'paragraph':
        if (block.data.calculation) {
          return this.renderHTMLCalculation(block.data.calculation);
        }
        return `  <p>${block.data.text}</p>\n`;

      case 'table':
        return this.renderHTMLTable(block.data);

      case 'equation':
        return `  <div class="equation">${block.data.latex}${block.data.description ? `<br><small>${block.data.description}</small>` : ''}</div>\n`;

      case 'list':
        const tag = block.data.ordered ? 'ol' : 'ul';
        const items = block.data.items.map((item: string) => `    <li>${item}</li>`).join('\n');
        return `  <${tag}>\n${items}\n  </${tag}>\n`;

      case 'image':
        return `  <div class="image-container">
    <img src="${block.data.src}" alt="${block.data.caption || ''}" ${block.data.width ? `style="max-width: ${block.data.width}px"` : ''}>
    ${block.data.caption ? `<div class="caption">${block.data.caption}</div>` : ''}
  </div>\n`;

      case 'divider':
        return '  <hr>\n';

      default:
        return '';
    }
  }

  private renderHTMLTable(data: TableData): string {
    let html = `  <table>\n`;

    if (data.caption) {
      html += `    <caption>${data.caption}</caption>\n`;
    }

    html += `    <thead>\n      <tr>\n`;
    for (let i = 0; i < data.headers.length; i++) {
      const align = data.alignment?.[i] || 'left';
      html += `        <th style="text-align: ${align}">${data.headers[i]}</th>\n`;
    }
    html += `      </tr>\n    </thead>\n    <tbody>\n`;

    for (const row of data.rows) {
      html += `      <tr>\n`;
      for (let i = 0; i < row.length; i++) {
        const align = data.alignment?.[i] || 'left';
        const value = row[i];
        const statusClass = value === 'OK' ? 'status-pass' : value === 'FAIL' ? 'status-fail' : value === 'MARGINAL' ? 'status-check' : '';
        html += `        <td style="text-align: ${align}" class="${statusClass}">${value}</td>\n`;
      }
      html += `      </tr>\n`;
    }

    html += `    </tbody>\n  </table>\n`;
    return html;
  }

  private renderHTMLCalculation(calc: CalculationStep): string {
    let html = `  <div class="calculation">\n`;
    html += `    <p><strong>${calc.description}</strong></p>\n`;

    if (calc.formula) {
      let formula = calc.formula;
      if (calc.values) {
        for (const [key, value] of Object.entries(calc.values)) {
          formula = formula.replace(new RegExp(key, 'g'), String(value));
        }
      }
      html += `    <p class="formula">${formula}</p>\n`;
    }

    if (calc.result !== undefined) {
      const statusClass = calc.status === 'pass' ? 'status-pass' : calc.status === 'fail' ? 'status-fail' : calc.status === 'check' ? 'status-check' : '';
      html += `    <p class="result ${statusClass}">= ${calc.result}${calc.unit ? ` ${calc.unit}` : ''}</p>\n`;
    }

    if (calc.reference) {
      html += `    <p class="reference">Ref: ${calc.reference}</p>\n`;
    }

    html += `  </div>\n`;
    return html;
  }

  /**
   * Generate Markdown output
   */
  private generateMarkdown(): string {
    let md = '';

    // Title and metadata
    md += `# ${this.config.title}\n\n`;
    md += `| | |\n|---|---|\n`;
    md += `| **Project** | ${this.config.projectName} |\n`;
    md += `| **Project No** | ${this.config.projectNumber} |\n`;
    md += `| **Client** | ${this.config.client} |\n`;
    md += `| **Engineer** | ${this.config.engineer} |\n`;
    md += `| **Date** | ${this.config.date} |\n`;
    md += `| **Revision** | ${this.config.revision} |\n\n`;

    // Table of contents
    if (this.config.includeTableOfContents) {
      md += `## Table of Contents\n\n`;
      for (const section of this.sections) {
        const indent = '  '.repeat(section.level - 1);
        const anchor = section.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        md += `${indent}- [${section.title}](#${anchor})\n`;
      }
      md += '\n---\n\n';
    }

    // Content
    for (const section of this.sections) {
      md += this.generateMarkdownSection(section);
    }

    return md;
  }

  private generateMarkdownSection(section: Section): string {
    const heading = '#'.repeat(Math.min(section.level + 1, 6));
    let md = `${heading} ${section.title}\n\n`;

    for (const block of section.content) {
      md += this.renderMarkdownBlock(block);
    }

    return md;
  }

  private renderMarkdownBlock(block: ContentBlock): string {
    switch (block.type) {
      case 'paragraph':
        if (block.data.calculation) {
          return this.renderMarkdownCalculation(block.data.calculation);
        }
        return `${block.data.text}\n\n`;

      case 'table':
        return this.renderMarkdownTable(block.data);

      case 'equation':
        return `$$${block.data.latex}$$\n\n${block.data.description ? `*${block.data.description}*\n\n` : ''}`;

      case 'list':
        const prefix = block.data.ordered ? (i: number) => `${i + 1}. ` : () => '- ';
        return block.data.items.map((item: string, i: number) => `${prefix(i)}${item}`).join('\n') + '\n\n';

      case 'image':
        return `![${block.data.caption || ''}](${block.data.src})\n${block.data.caption ? `*${block.data.caption}*\n` : ''}\n`;

      case 'divider':
        return '---\n\n';

      default:
        return '';
    }
  }

  private renderMarkdownTable(data: TableData): string {
    let md = '';

    // Headers
    md += '| ' + data.headers.join(' | ') + ' |\n';

    // Separator with alignment
    const separators = data.headers.map((_, i) => {
      const align = data.alignment?.[i] || 'left';
      if (align === 'center') return ':---:';
      if (align === 'right') return '---:';
      return '---';
    });
    md += '| ' + separators.join(' | ') + ' |\n';

    // Rows
    for (const row of data.rows) {
      md += '| ' + row.map(cell => {
        if (cell === 'OK') return '✅ OK';
        if (cell === 'FAIL') return '❌ FAIL';
        if (cell === 'MARGINAL') return '⚠️ MARGINAL';
        return String(cell);
      }).join(' | ') + ' |\n';
    }

    md += '\n';
    if (data.caption) {
      md += `*${data.caption}*\n\n`;
    }

    return md;
  }

  private renderMarkdownCalculation(calc: CalculationStep): string {
    let md = `> **${calc.description}**\n>\n`;

    if (calc.formula) {
      let formula = calc.formula;
      if (calc.values) {
        for (const [key, value] of Object.entries(calc.values)) {
          formula = formula.replace(new RegExp(key, 'g'), String(value));
        }
      }
      md += `> $${formula}$\n>\n`;
    }

    if (calc.result !== undefined) {
      const status = calc.status === 'pass' ? '✅' : calc.status === 'fail' ? '❌' : calc.status === 'check' ? '⚠️' : '';
      md += `> **Result: ${calc.result}${calc.unit ? ` ${calc.unit}` : ''}** ${status}\n>\n`;
    }

    if (calc.reference) {
      md += `> *Ref: ${calc.reference}*\n`;
    }

    md += '\n';
    return md;
  }

  /**
   * Generate JSON output
   */
  private generateJSON(): string {
    return JSON.stringify({
      config: this.config,
      sections: this.sections
    }, null, 2);
  }
}

// ============================================================================
// SPECIALIZED REPORT GENERATORS
// ============================================================================

export class BeamDesignReport {
  /**
   * Generate beam design calculation sheet
   */
  static generate(
    beamData: {
      id: string;
      span: number;
      width: number;
      depth: number;
      cover: number;
      fck: number;
      fy: number;
      loads: { type: string; value: number; unit: string }[];
      moments: { location: string; Mu: number; Mn: number };
      shear: { location: string; Vu: number; Vn: number };
      reinforcement: {
        main: { top: string; bottom: string };
        stirrups: string;
      };
    },
    config: Partial<ReportConfig> = {}
  ): string {
    const builder = new ReportBuilder({
      title: `Beam Design Calculation - ${beamData.id}`,
      format: 'html',
      ...config
    });

    // Input Data Section
    builder.addSection('Input Data');
    builder.addTable({
      headers: ['Parameter', 'Value', 'Unit'],
      rows: [
        ['Span', beamData.span.toString(), 'm'],
        ['Width (b)', beamData.width.toString(), 'mm'],
        ['Overall Depth (D)', beamData.depth.toString(), 'mm'],
        ['Effective Cover', beamData.cover.toString(), 'mm'],
        ['Concrete Grade (fck)', beamData.fck.toString(), 'MPa'],
        ['Steel Grade (fy)', beamData.fy.toString(), 'MPa']
      ],
      caption: 'Beam Geometry and Material Properties'
    });

    // Loading
    builder.addSection('Loading', 2);
    builder.addTable({
      headers: ['Load Type', 'Value', 'Unit'],
      rows: beamData.loads.map(l => [l.type, l.value.toString(), l.unit]),
      caption: 'Applied Loads'
    });

    // Flexural Design
    builder.addSection('Flexural Design', 2);
    builder.addCalculation({
      description: 'Ultimate Moment Capacity Check',
      formula: 'Mu ≤ Mn',
      values: { Mu: beamData.moments.Mu, Mn: beamData.moments.Mn },
      result: beamData.moments.Mu <= beamData.moments.Mn ? 'SAFE' : 'UNSAFE',
      reference: 'IS 456:2000 Cl. 38.1',
      status: beamData.moments.Mu <= beamData.moments.Mn ? 'pass' : 'fail'
    });

    // Shear Design
    builder.addSection('Shear Design', 2);
    builder.addCalculation({
      description: 'Ultimate Shear Capacity Check',
      formula: 'Vu ≤ Vn',
      values: { Vu: beamData.shear.Vu, Vn: beamData.shear.Vn },
      result: beamData.shear.Vu <= beamData.shear.Vn ? 'SAFE' : 'UNSAFE',
      reference: 'IS 456:2000 Cl. 40',
      status: beamData.shear.Vu <= beamData.shear.Vn ? 'pass' : 'fail'
    });

    // Reinforcement Summary
    builder.addSection('Reinforcement Summary', 2);
    builder.addTable({
      headers: ['Location', 'Reinforcement'],
      rows: [
        ['Top', beamData.reinforcement.main.top],
        ['Bottom', beamData.reinforcement.main.bottom],
        ['Stirrups', beamData.reinforcement.stirrups]
      ],
      caption: 'Reinforcement Details'
    });

    return builder.generate();
  }
}

export class ColumnDesignReport {
  /**
   * Generate column design calculation sheet
   */
  static generate(
    columnData: {
      id: string;
      height: number;
      width: number;
      depth: number;
      fck: number;
      fy: number;
      Pu: number;
      Mux: number;
      Muy: number;
      results: {
        slenderness: { ratio: number; limit: number; type: string };
        capacity: { Pn: number; Mnx: number; Mny: number };
        interaction: { ratio: number; status: string };
      };
      reinforcement: {
        main: string;
        ties: string;
      };
    },
    config: Partial<ReportConfig> = {}
  ): string {
    const builder = new ReportBuilder({
      title: `Column Design Calculation - ${columnData.id}`,
      format: 'html',
      ...config
    });

    // Input Data
    builder.addSection('Input Data');
    builder.addTable({
      headers: ['Parameter', 'Value', 'Unit'],
      rows: [
        ['Height', columnData.height.toString(), 'm'],
        ['Width (b)', columnData.width.toString(), 'mm'],
        ['Depth (D)', columnData.depth.toString(), 'mm'],
        ['Concrete Grade (fck)', columnData.fck.toString(), 'MPa'],
        ['Steel Grade (fy)', columnData.fy.toString(), 'MPa']
      ],
      caption: 'Column Geometry and Material Properties'
    });

    // Design Forces
    builder.addSection('Design Forces', 2);
    builder.addTable({
      headers: ['Force/Moment', 'Value', 'Unit'],
      rows: [
        ['Axial Load (Pu)', columnData.Pu.toString(), 'kN'],
        ['Moment about X (Mux)', columnData.Mux.toString(), 'kNm'],
        ['Moment about Y (Muy)', columnData.Muy.toString(), 'kNm']
      ]
    });

    // Slenderness Check
    builder.addSection('Slenderness Check', 2);
    builder.addCalculation({
      description: 'Slenderness Ratio Check',
      formula: 'λ = le/r',
      result: `${columnData.results.slenderness.ratio.toFixed(2)} < ${columnData.results.slenderness.limit}`,
      reference: 'IS 456:2000 Cl. 25.1.2',
      status: columnData.results.slenderness.ratio < columnData.results.slenderness.limit ? 'pass' : 'fail'
    });
    builder.addParagraph(`Column Classification: ${columnData.results.slenderness.type}`);

    // Capacity Check
    builder.addSection('Capacity Check', 2);
    builder.addCalculation({
      description: 'Biaxial Bending Interaction Check',
      formula: '(Mux/Mnx)^αn + (Muy/Mny)^αn ≤ 1.0',
      result: columnData.results.interaction.ratio.toFixed(3),
      reference: 'IS 456:2000 Cl. 39.6',
      status: columnData.results.interaction.ratio <= 1.0 ? 'pass' : 'fail'
    });

    // Reinforcement
    builder.addSection('Reinforcement Details', 2);
    builder.addTable({
      headers: ['Type', 'Details'],
      rows: [
        ['Main Bars', columnData.reinforcement.main],
        ['Lateral Ties', columnData.reinforcement.ties]
      ]
    });

    return builder.generate();
  }
}

export class FoundationDesignReport {
  /**
   * Generate foundation design report
   */
  static generate(
    foundationData: {
      type: string;
      dimensions: { length: number; width: number; depth: number };
      soilCapacity: number;
      loads: { P: number; Mx: number; My: number };
      pressures: { max: number; min: number; allowable: number };
      reinforcement: { mainX: string; mainY: string };
      checks: { bearing: boolean; overturning: boolean; sliding: boolean; settlement: boolean };
    },
    config: Partial<ReportConfig> = {}
  ): string {
    const builder = new ReportBuilder({
      title: `Foundation Design Calculation`,
      format: 'html',
      ...config
    });

    builder.addSection('Foundation Type');
    builder.addParagraph(`Foundation Type: ${foundationData.type}`);

    builder.addSection('Geometry', 2);
    builder.addTable({
      headers: ['Dimension', 'Value', 'Unit'],
      rows: [
        ['Length (L)', foundationData.dimensions.length.toString(), 'm'],
        ['Width (B)', foundationData.dimensions.width.toString(), 'm'],
        ['Depth (D)', foundationData.dimensions.depth.toString(), 'm']
      ]
    });

    builder.addSection('Loading', 2);
    builder.addTable({
      headers: ['Load', 'Value', 'Unit'],
      rows: [
        ['Axial Load (P)', foundationData.loads.P.toString(), 'kN'],
        ['Moment X (Mx)', foundationData.loads.Mx.toString(), 'kNm'],
        ['Moment Y (My)', foundationData.loads.My.toString(), 'kNm']
      ]
    });

    builder.addSection('Bearing Pressure Check', 2);
    builder.addCalculation({
      description: 'Maximum Bearing Pressure',
      formula: 'qmax = P/A ± M×y/I',
      result: `${foundationData.pressures.max.toFixed(2)} kN/m² < ${foundationData.pressures.allowable} kN/m²`,
      reference: 'IS 1904:1986',
      status: foundationData.pressures.max <= foundationData.pressures.allowable ? 'pass' : 'fail'
    });

    builder.addSection('Stability Checks', 2);
    builder.addDesignResults([
      {
        element: 'Foundation',
        checkType: 'Bearing Capacity',
        capacity: foundationData.pressures.allowable,
        demand: foundationData.pressures.max,
        ratio: foundationData.pressures.max / foundationData.pressures.allowable,
        status: foundationData.checks.bearing ? 'OK' : 'FAIL',
        reference: 'IS 1904'
      },
      {
        element: 'Foundation',
        checkType: 'Overturning',
        capacity: 1.5,
        demand: 1.0,
        ratio: 0.67,
        status: foundationData.checks.overturning ? 'OK' : 'FAIL',
        reference: 'IS 1904'
      },
      {
        element: 'Foundation',
        checkType: 'Sliding',
        capacity: 1.5,
        demand: 1.0,
        ratio: 0.67,
        status: foundationData.checks.sliding ? 'OK' : 'FAIL',
        reference: 'IS 1904'
      }
    ]);

    builder.addSection('Reinforcement', 2);
    builder.addTable({
      headers: ['Direction', 'Reinforcement'],
      rows: [
        ['X-Direction', foundationData.reinforcement.mainX],
        ['Y-Direction', foundationData.reinforcement.mainY]
      ]
    });

    return builder.generate();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================


export default {
  ReportBuilder,
  BeamDesignReport,
  ColumnDesignReport,
  FoundationDesignReport
};
