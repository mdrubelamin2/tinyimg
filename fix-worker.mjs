import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/store/image-store.ts');
let content = fs.readFileSync(file, 'utf8');

// Update worker instantiation to use Vite's recommended ?worker suffix import
// This forces Vite to compile it correctly as a separate chunk rather than relying on URL() constructor
content = content.replace(
  "const workerUrl = new URL('../workers/optimizer.worker.ts', import.meta.url);",
  "// Vite worker import\n  const workerUrl = new URL('@/workers/optimizer.worker.ts?worker&url', import.meta.url);"
);

// We need to modify Vite config to handle the query parameter correctly if it wasn't already
fs.writeFileSync(file, content);
console.log('Updated image-store.ts');
