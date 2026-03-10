import { build } from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname_build = dirname(fileURLToPath(import.meta.url));
const require_build = createRequire(import.meta.url);

async function main() {
    console.log('🔨 Building API with esbuild (bundled)...');
    
    try {
        const result = await build({
            entryPoints: ['./src/index.ts'],
            outfile: './dist/index.cjs',
            platform: 'node',
            target: 'node20',
            format: 'cjs',
            bundle: true,
            sourcemap: true,
            minify: false,
            // Keep ONLY native addons as external - bundle everything else
            external: [
                // Native addon that absolutely cannot be bundled
                '@sentry/profiling-node',
            ],
            logLevel: 'info',
        });
        
        console.log('✅ Build completed successfully!');
        if (result.warnings.length > 0) {
            console.warn('⚠️  Warnings:', result.warnings);
        }
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

main();
