const fs = require('fs');
const path = require('path');

// Read the logo file
const logoPath = path.join(__dirname, '../public/branding/logo.png');
const logoBuffer = fs.readFileSync(logoPath);
const logoBase64 = logoBuffer.toString('base64');

// Create the TypeScript file content
const tsContent = `/**
 * Logo Data - Base64 Encoded Logo for PDF Reports
 * 
 * This file contains the base64-encoded BeamLab logo for embedding in PDF reports.
 * Generated from public/branding/logo.png
 */

export const LOGO_BASE64 = 'data:image/jpeg;base64,${logoBase64}';
`;

// Write to LogoData.ts
const outputPath = path.join(__dirname, 'LogoData.ts');
fs.writeFileSync(outputPath, tsContent);

console.log('✅ Logo data generated successfully!');
console.log('   Output:', outputPath);
console.log('   Size:', Math.round(logoBase64.length / 1024), 'KB (base64)');
