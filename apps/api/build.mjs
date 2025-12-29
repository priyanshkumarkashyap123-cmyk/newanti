import { build } from 'esbuild';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

// Find all TypeScript files in src directory
async function findTsFiles(dir) {
    const files = [];
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await findTsFiles(fullPath));
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

async function main() {
    console.log('🔨 Building API with esbuild...');
    
    try {
        const entryPoints = await findTsFiles('./src');
        
        await build({
            entryPoints,
            outdir: './dist',
            platform: 'node',
            target: 'node20',
            format: 'esm',
            bundle: false,
            sourcemap: true,
            outExtension: { '.js': '.js' },
            logLevel: 'info'
        });
        
        console.log('✅ Build completed successfully!');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

main();
