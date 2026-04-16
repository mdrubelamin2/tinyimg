#!/usr/bin/env node
/**
 * Compare gzip sizes of dist/assets/*.js against scripts/perf-budgets.json.
 * Run after: npm run build
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distAssets = join(root, 'dist', 'assets');

if (!existsSync(distAssets)) {
  console.error('dist/assets not found. Run npm run build first.');
  process.exit(1);
}

const budgets = JSON.parse(readFileSync(join(root, 'scripts', 'perf-budgets.json'), 'utf8'));
const maxAny = budgets.maxAnyChunkGzipBytes;
const maxTotal = budgets.maxTotalJsGzipBytes;

const files = readdirSync(distAssets).filter((f) => f.endsWith('.js'));
let totalGzip = 0;
let maxChunk = { name: '', bytes: 0 };

for (const f of files) {
  const buf = readFileSync(join(distAssets, f));
  const gz = gzipSync(buf).length;
  totalGzip += gz;
  if (gz > maxChunk.bytes) maxChunk = { name: f, bytes: gz };
}

console.log(`Perf budgets: largest chunk gzip ${(maxChunk.bytes / 1024).toFixed(1)} KB (${maxChunk.name})`);
console.log(`Total JS gzip (all chunks): ${(totalGzip / 1024).toFixed(1)} KB`);

let failed = false;
if (maxChunk.bytes > maxAny) {
  console.error(`FAIL: largest chunk gzip ${maxChunk.bytes} > budget ${maxAny}`);
  failed = true;
}
if (totalGzip > maxTotal) {
  console.error(`FAIL: total JS gzip ${totalGzip} > budget ${maxTotal}`);
  failed = true;
}
if (!failed) console.log('Perf budget check passed.');
process.exit(failed ? 1 : 0);
