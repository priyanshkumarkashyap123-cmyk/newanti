import type { jsPDF as JsPDFType } from 'jspdf';
import type { CheckStatus } from '../DetailedReportEngine';

export const STATUS_TEXT_COLORS: Record<Exclude<CheckStatus, 'NOT_APPLICABLE'>, [number, number, number]> = {
    PASS: [22, 163, 74],
    FAIL: [220, 38, 38],
    WARNING: [217, 119, 6],
};

export const STATUS_FILL_COLORS: Partial<Record<Exclude<CheckStatus, 'NOT_APPLICABLE'>, [number, number, number]>> = {
    FAIL: [254, 226, 226],
};

export const REPORT_DISCLAIMER = 'This document is prepared for the exclusive use of the client. Any reproduction or distribution without written permission is prohibited.';
export const REASONABLE_CARE_STATEMENT = 'This report has been prepared with reasonable skill and care. The conclusions and recommendations are based on the information available at the time of the analysis.';

export const applyStatusCellStyle = (data: any): void => {
    if (data.section !== 'body') return;
    const status = data.cell.raw as CheckStatus;
    const textColor = STATUS_TEXT_COLORS[status as Exclude<CheckStatus, 'NOT_APPLICABLE'>];
    if (!textColor) return;
    data.cell.styles.textColor = textColor;
    data.cell.styles.fontStyle = 'bold';
    const fillColor = STATUS_FILL_COLORS[status as Exclude<CheckStatus, 'NOT_APPLICABLE'>];
    if (fillColor) {
        data.cell.styles.fillColor = fillColor;
    }
};

export type ReportDoc = JsPDFType;
