const { spawn } = require('child_process');

console.log('Starting test execution with vitest...');

const testProcess = spawn('pnpm', [
    'vitest',
    'run',
    'src/services/space-planning/__tests__/architecturalPlacement.advanced.test.ts'
], {
    cwd: '/Users/rakshittiwari/Desktop/newanti/apps/web',
    shell: true
});

testProcess.stdout.on('data', (data) => {
    process.stdout.write(data.toString());
});

testProcess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
});

testProcess.on('close', (code) => {
    console.log(`\n\nTest process exited with code ${code}`);
});
