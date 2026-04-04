#!/usr/bin/env node
/**
 * Minimal startup test - checks if the built dist/index.js can be required
 */
console.log('Starting Node.js version test...');
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());
console.log('PORT env:', process.env.PORT || 'not set, defaulting to 3001');

try {
  console.log('Attempting to import dist/index.js...');
  // Try to dynamically import the main file
  import('./dist/index.js').then(() => {
    console.log('✅ App startup successful!');
  }).catch((err) => {
    console.error('❌ App startup failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  });
} catch (err) {
  console.error('❌ Error importing dist/index.js:', err);
  process.exit(1);
}

// Timeout after 10 seconds
setTimeout(() => {
  console.log('✅ Startup test completed successfully');
  process.exit(0);
}, 10000);
