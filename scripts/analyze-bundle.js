/**
 * Bundle Analysis Script
 * 
 * Analyzes the production bundle size and provides insights
 * 
 * Run: node scripts/analyze-bundle.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Configuration
const DIST_DIR = path.join(__dirname, '../apps/web/dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');

// Size thresholds (in KB)
const THRESHOLDS = {
  maxTotalSize: 2000,      // 2MB total
  maxMainBundle: 500,      // 500KB main bundle
  maxChunkSize: 300,       // 300KB per chunk
  warnChunkSize: 150,      // Warn if chunk > 150KB
};

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

function getBrotliSize(filePath) {
  const content = fs.readFileSync(filePath);
  try {
    return zlib.brotliCompressSync(content).length;
  } catch {
    return null;
  }
}

function analyzeFile(filePath) {
  const stats = fs.statSync(filePath);
  const gzipSize = getGzipSize(filePath);
  const brotliSize = getBrotliSize(filePath);
  
  return {
    name: path.basename(filePath),
    path: filePath,
    size: stats.size,
    gzipSize,
    brotliSize,
  };
}

function getFileType(filename) {
  if (filename.endsWith('.js')) return 'JavaScript';
  if (filename.endsWith('.css')) return 'CSS';
  if (filename.endsWith('.wasm')) return 'WebAssembly';
  if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) return 'Image';
  if (filename.match(/\.(woff|woff2|ttf|eot)$/)) return 'Font';
  return 'Other';
}

function printHeader(text) {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}${text}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function printSection(text) {
  console.log(`\n${colors.bold}${colors.blue}${text}${colors.reset}`);
  console.log(`${colors.blue}${'-'.repeat(40)}${colors.reset}`);
}

function getSizeColor(size, isGzip = false) {
  const kb = size / 1024;
  const threshold = isGzip ? THRESHOLDS.warnChunkSize / 3 : THRESHOLDS.warnChunkSize;
  const maxThreshold = isGzip ? THRESHOLDS.maxChunkSize / 3 : THRESHOLDS.maxChunkSize;
  
  if (kb > maxThreshold) return colors.red;
  if (kb > threshold) return colors.yellow;
  return colors.green;
}

function main() {
  printHeader('📦 Bundle Analysis Report');

  // Check if dist exists
  if (!fs.existsSync(DIST_DIR)) {
    console.log(`${colors.red}Error: Build directory not found at ${DIST_DIR}${colors.reset}`);
    console.log('Run "pnpm build" first to generate the production build.\n');
    process.exit(1);
  }

  // Collect all files
  const files = [];
  
  function collectFiles(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        collectFiles(fullPath);
      } else {
        files.push(analyzeFile(fullPath));
      }
    }
  }

  collectFiles(DIST_DIR);

  // Group by type
  const byType = {};
  files.forEach((file) => {
    const type = getFileType(file.name);
    if (!byType[type]) byType[type] = [];
    byType[type].push(file);
  });

  // Calculate totals
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalGzip = files.reduce((sum, f) => sum + f.gzipSize, 0);
  const totalBrotli = files.reduce((sum, f) => sum + (f.brotliSize || 0), 0);

  // Print summary
  printSection('📊 Summary');
  console.log(`Total Files: ${files.length}`);
  console.log(`Total Size:  ${formatBytes(totalSize)}`);
  console.log(`Gzip Size:   ${formatBytes(totalGzip)}`);
  console.log(`Brotli Size: ${formatBytes(totalBrotli)}`);

  // Print by type
  printSection('📁 By File Type');
  Object.entries(byType).forEach(([type, typeFiles]) => {
    const typeTotal = typeFiles.reduce((sum, f) => sum + f.size, 0);
    const typeGzip = typeFiles.reduce((sum, f) => sum + f.gzipSize, 0);
    console.log(`${type.padEnd(15)} ${typeFiles.length.toString().padStart(3)} files  ${formatBytes(typeTotal).padStart(10)}  (gzip: ${formatBytes(typeGzip)})`);
  });

  // Print JavaScript bundles (usually the largest)
  if (byType['JavaScript']) {
    printSection('📦 JavaScript Bundles');
    
    const jsBundles = byType['JavaScript']
      .sort((a, b) => b.gzipSize - a.gzipSize)
      .slice(0, 15);
    
    console.log(`${'File'.padEnd(45)} ${'Size'.padStart(10)} ${'Gzip'.padStart(10)}`);
    console.log('-'.repeat(67));
    
    jsBundles.forEach((file) => {
      const sizeColor = getSizeColor(file.size);
      const gzipColor = getSizeColor(file.gzipSize, true);
      const name = file.name.length > 43 ? '...' + file.name.slice(-40) : file.name;
      
      console.log(
        `${name.padEnd(45)} ${sizeColor}${formatBytes(file.size).padStart(10)}${colors.reset} ${gzipColor}${formatBytes(file.gzipSize).padStart(10)}${colors.reset}`
      );
    });
  }

  // Print CSS
  if (byType['CSS']) {
    printSection('🎨 CSS Bundles');
    byType['CSS'].forEach((file) => {
      console.log(`${file.name.padEnd(45)} ${formatBytes(file.size).padStart(10)} (gzip: ${formatBytes(file.gzipSize)})`);
    });
  }

  // Print WASM if present
  if (byType['WebAssembly']) {
    printSection('⚡ WebAssembly Modules');
    byType['WebAssembly'].forEach((file) => {
      console.log(`${file.name.padEnd(45)} ${formatBytes(file.size).padStart(10)} (gzip: ${formatBytes(file.gzipSize)})`);
    });
  }

  // Threshold checks
  printSection('✅ Threshold Checks');
  
  const checks = [];
  
  // Total size check
  const totalKB = totalGzip / 1024;
  if (totalKB > THRESHOLDS.maxTotalSize) {
    checks.push({ pass: false, message: `Total gzip size (${formatBytes(totalGzip)}) exceeds ${THRESHOLDS.maxTotalSize}KB limit` });
  } else {
    checks.push({ pass: true, message: `Total gzip size (${formatBytes(totalGzip)}) is within ${THRESHOLDS.maxTotalSize}KB limit` });
  }

  // Main bundle check
  const mainBundle = byType['JavaScript']?.find(f => f.name.includes('index'));
  if (mainBundle) {
    const mainKB = mainBundle.gzipSize / 1024;
    if (mainKB > THRESHOLDS.maxMainBundle / 3) {
      checks.push({ pass: false, message: `Main bundle gzip (${formatBytes(mainBundle.gzipSize)}) exceeds ${THRESHOLDS.maxMainBundle / 3}KB limit` });
    } else {
      checks.push({ pass: true, message: `Main bundle gzip (${formatBytes(mainBundle.gzipSize)}) is within limit` });
    }
  }

  // Large chunks check
  const largeChunks = byType['JavaScript']?.filter(f => f.gzipSize / 1024 > THRESHOLDS.maxChunkSize / 3) || [];
  if (largeChunks.length > 0) {
    checks.push({ pass: false, message: `${largeChunks.length} chunk(s) exceed ${THRESHOLDS.maxChunkSize / 3}KB gzip limit` });
  } else {
    checks.push({ pass: true, message: 'All chunks are within size limits' });
  }

  checks.forEach(({ pass, message }) => {
    const icon = pass ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`${icon} ${message}`);
  });

  // Recommendations
  const warnings = byType['JavaScript']?.filter(f => {
    const kb = f.gzipSize / 1024;
    return kb > THRESHOLDS.warnChunkSize / 3 && kb <= THRESHOLDS.maxChunkSize / 3;
  }) || [];

  if (warnings.length > 0) {
    printSection('⚠️  Recommendations');
    warnings.forEach((file) => {
      console.log(`${colors.yellow}Consider code-splitting: ${file.name} (${formatBytes(file.gzipSize)} gzip)${colors.reset}`);
    });
  }

  // Exit code
  const hasErrors = checks.some(c => !c.pass);
  console.log('');
  
  if (hasErrors) {
    console.log(`${colors.red}${colors.bold}Bundle analysis failed! Please optimize your bundles.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}Bundle analysis passed!${colors.reset}\n`);
    process.exit(0);
  }
}

main();
