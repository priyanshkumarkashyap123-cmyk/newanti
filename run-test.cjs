const { spawn } = require('child_process');

console.log('Starting test execution...');

// Using npx jest to run the specific test file
const testProcess = spawn('npx', [
    'jest',
    'apps/web/src/services/space-planning/__tests__/architecturalPlacement.advanced.test.ts',
    '--passWithNoTests'
], {
    cwd: '/Users/rakshittiwari/Desktop/newanti',
    shell: true
});

let output = '';

testProcess.stdout.on('data', (data) => {
    output += data.toString();
    process.stdout.write(data.toString());
});

testProcess.stderr.on('data', (data) => {
    output += data.toString();
    process.stderr.write(data.toString());
});

testProcess.on('close', (code) => {
    console.log(`\n\nTest process exited with code ${code}`);
});
