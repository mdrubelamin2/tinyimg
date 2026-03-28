import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/store/image-store.ts');
let content = fs.readFileSync(file, 'utf8');

// Alternative explicit Vite worker import pattern
// Vite docs: import MyWorker from './worker?worker'
const updatedContent = content.replace(
  "// Vite worker import\n  const workerUrl = new URL('@/workers/optimizer.worker.ts?worker&url', import.meta.url);",
  "import WorkerUrl from '@/workers/optimizer.worker.ts?url';\n  const workerUrl = new URL(WorkerUrl, import.meta.url);"
);

// Actually, we need the import at the top of the file.
// Let's rewrite it cleanly:
const fullContent = content
  .replace(
    "import { revokeResultUrls, buildAndDownloadZip } from '@/lib/download';",
    "import { revokeResultUrls, buildAndDownloadZip } from '@/lib/download';\nimport OptimizerWorkerUrl from '@/workers/optimizer.worker.ts?worker&url';"
  )
  .replace(
    "// Vite worker import\n  const workerUrl = new URL('@/workers/optimizer.worker.ts?worker&url', import.meta.url);",
    "const workerUrl = new URL(OptimizerWorkerUrl, import.meta.url);"
  );

fs.writeFileSync(file, fullContent);
console.log('Fixed imports again');
