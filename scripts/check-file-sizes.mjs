import { execSync } from 'node:child_process';

const threshold = Number(process.env.FILE_SIZE_THRESHOLD ?? 600);
const output = execSync("find apps/web/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -nr", {
  encoding: 'utf8',
});

const oversized = output
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^\d+\s+/.test(line))
  .map((line) => {
    const [count, ...rest] = line.split(/\s+/);
    return { count: Number(count), file: rest.join(' ') };
  })
  .filter(({ count }) => count > threshold);

if (oversized.length === 0) {
  console.log(`OK: no frontend files exceed ${threshold} lines.`);
  process.exit(0);
}

console.error(`FAIL: ${oversized.length} files exceed ${threshold} lines.`);
for (const item of oversized.slice(0, 50)) {
  console.error(`${item.count.toString().padStart(5, ' ')}  ${item.file}`);
}

process.exit(1);
