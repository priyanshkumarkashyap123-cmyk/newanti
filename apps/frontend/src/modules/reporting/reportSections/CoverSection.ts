import type { DetailedReportEngine } from '../DetailedReportEngine';

export function renderCoverSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.pageNumber = 1;
    
    // Header band
    e.doc.setFillColor(e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b);
    e.doc.rect(0, 0, e.pageWidth, 70, 'F');
    
    // Company info
    e.doc.setTextColor(255, 255, 255);
    e.doc.setFontSize(16);
    e.doc.setFont('helvetica', 'bold');
    e.doc.text(e.data.company.name, e.margins.left, 25);
    
    e.doc.setFontSize(9);
    e.doc.setFont('helvetica', 'normal');
    e.doc.text(e.data.company.address, e.margins.left, 35);
    e.doc.text(`Tel: ${e.data.company.phone} | Email: ${e.data.company.email}`, e.margins.left, 42);
    if (e.data.company.license) e.doc.text(`License: ${e.data.company.license}`, e.margins.left, 49);
    
    // Report title
    e.doc.setFontSize(28);
    e.doc.setFont('helvetica', 'bold');
    e.doc.text(e.settings.title.toUpperCase(), e.pageWidth / 2, 90, { align: 'center' });
    if (e.settings.subtitle) {
        e.doc.setFontSize(16);
        e.doc.setFont('helvetica', 'normal');
        e.doc.text(e.settings.subtitle, e.pageWidth / 2, 100, { align: 'center' });
    }
    
    // Project info box
    e.doc.setDrawColor(e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b);
    e.doc.setLineWidth(1);
    e.doc.roundedRect(e.margins.left, 115, e.contentWidth, 60, 3, 3, 'S');
    
    e.doc.setTextColor(e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b);
    e.doc.setFontSize(11);
    e.doc.setFont('helvetica', 'bold');
    e.doc.text('PROJECT INFORMATION', e.margins.left + 5, 125);
    
    e.doc.setTextColor(0, 0, 0);
    e.doc.setFontSize(10);
    let infoY = 135;
    [['Project Name:', e.data.project.name], ['Project Number:', e.data.project.number], ['Client:', e.data.project.client], ['Location:', e.data.project.location], ['Structure Type:', e.data.project.structureType]].forEach(([label, value]) => {
        e.doc.setFont('helvetica', 'bold');
        e.doc.text(label as string, e.margins.left + 5, infoY);
        e.doc.setFont('helvetica', 'normal');
        e.doc.text(value as string, e.margins.left + 45, infoY);
        infoY += 7;
    });
    
    // Document control box
    e.doc.roundedRect(e.margins.left, 185, e.contentWidth, 50, 3, 3, 'S');
    e.doc.setTextColor(e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b);
    e.doc.setFontSize(11);
    e.doc.setFont('helvetica', 'bold');
    e.doc.text('DOCUMENT CONTROL', e.margins.left + 5, 195);
    
    e.doc.setTextColor(0, 0, 0);
    e.doc.setFontSize(10);
    let docY = 205;
    [['Revision:', e.settings.revision], ['Date:', (e.format || ((d: Date) => d.toLocaleDateString()))(e.settings.date)], ['Prepared By:', e.data.engineer.designEngineer.name], ['Checked By:', e.data.engineer.checker?.name || '-']].forEach(([label, value]) => {
        e.doc.setFont('helvetica', 'bold');
        e.doc.text(label as string, e.margins.left + 5, docY);
        e.doc.setFont('helvetica', 'normal');
        e.doc.text(value as string, e.margins.left + 35, docY);
        docY += 7;
    });
    
    // Confidentiality notice
    if (e.settings.confidential) {
        e.doc.setFillColor(220, 38, 38);
        e.doc.roundedRect(e.pageWidth / 2 - 40, 250, 80, 12, 2, 2, 'F');
        e.doc.setTextColor(255, 255, 255);
        e.doc.setFontSize(10);
        e.doc.setFont('helvetica', 'bold');
        e.doc.text('CONFIDENTIAL', e.pageWidth / 2, 258, { align: 'center' });
    }
    
    // Footer disclaimer
    e.doc.setTextColor(100, 100, 100);
    e.doc.setFontSize(8);
    e.doc.setFont('helvetica', 'italic');
    const REPORT_DISCLAIMER = 'This document is prepared for the exclusive use of the client. Any reproduction or distribution without written permission is prohibited.';
    e.doc.text(REPORT_DISCLAIMER, e.pageWidth / 2, e.pageHeight - 20, { align: 'center', maxWidth: e.contentWidth });
    e.currentY = e.pageHeight - 30;
}
