import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read the SVG logo file
const logoPath = fileURLToPath(new URL('../public/branding/beamlab_icon_colored.svg', import.meta.url));
const logoBuffer = fs.readFileSync(logoPath);
const logoBase64 = logoBuffer.toString('base64');

// Create the TypeScript file content
const tsContent = `/**
 * Logo Data - Base64 Encoded Logo for PDF Reports
 *
 * This file contains the base64-encoded BeamLab logo for embedding in PDF reports.
 * Generated from public/branding/beamlab_icon_colored.svg
 */

export const LOGO_BASE64 = 'data:image/svg+xml;base64,${logoBase64}';
`;

// Write to LogoData.ts
const outputPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'LogoData.ts');
fs.writeFileSync(outputPath, tsContent);

console.log('✅ Logo data generated successfully!');
console.log('   Output:', outputPath);
console.log('   Size:', Math.round(logoBase64.length / 1024), 'KB (base64)');
