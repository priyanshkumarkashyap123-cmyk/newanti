/**
 * Output format and display configurations for reports
 */

import { FileText, FileType, FileCode, FileSpreadsheet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type OutputFormat = 'pdf' | 'docx' | 'html' | 'xlsx';

export interface FormatConfig {
    name: string;
    icon: LucideIcon;
    extension: string;
}

export const OUTPUT_FORMATS: Record<OutputFormat, FormatConfig> = {
    pdf: { name: 'PDF Document', icon: FileText, extension: '.pdf' },
    docx: { name: 'Word Document', icon: FileType, extension: '.docx' },
    html: { name: 'HTML Report', icon: FileCode, extension: '.html' },
    xlsx: { name: 'Excel Spreadsheet', icon: FileSpreadsheet, extension: '.xlsx' },
} as const;
