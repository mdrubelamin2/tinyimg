#!/usr/bin/env node
/**
 * Fail if total raw WASM bytes in dist/assets exceed scripts/wasm-budgets.json.
 * Run after: npm run build
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const distAssets = join(root, 'dist', 'assets')

if (!existsSync(distAssets)) {
  console.error('dist/assets not found. Run npm run build first.')
  process.exit(1)
}

const budgets = JSON.parse(readFileSync(join(root, 'scripts', 'wasm-budgets.json'), 'utf8'))
const maxTotal = budgets.maxTotalWasmBytes

const wasmFiles = readdirSync(distAssets).filter((f) => f.endsWith('.wasm'))
let totalBytes = 0
for (const f of wasmFiles) {
  totalBytes += statSync(join(distAssets, f)).size
}

console.log(
  `WASM budget: ${wasmFiles.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB raw total`,
)

if (totalBytes > maxTotal) {
  console.error(`FAIL: total WASM ${totalBytes} > budget ${maxTotal}`)
  process.exit(1)
}

console.log('WASM budget check passed.')
process.exit(0)
