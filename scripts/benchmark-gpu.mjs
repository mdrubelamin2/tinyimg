import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runBenchmark() {
  console.log('Running GPU vs CPU benchmark...');
  
  const iterations = 10;
  const gpuTimes = [];
  const cpuTimes = [];
  
  for (let i = 0; i < iterations; i++) {
    const bitmap = await createImageBitmap(new OffscreenCanvas(3840, 2160));
    const gpuStart = performance.now();
    await new Promise((resolve) => {
      const worker = new Worker(join(__dirname, '../src/workers/gpu.worker.ts'), { type: 'module' });
      worker.onmessage = () => {
        gpuTimes.push(performance.now() - gpuStart);
        worker.terminate();
        resolve();
      };
      worker.postMessage({ 
        type: 'resize', 
        payload: { 
          bitmap: bitmap,
          width: 1920,
          height: 1080 
        } 
      });
    });
    
    const cpuStart = performance.now();
    const canvas = new OffscreenCanvas(3840, 2160);
    const target = new OffscreenCanvas(1920, 1080);
    const ctx = target.getContext('2d');
    ctx?.drawImage(canvas, 0, 0, 1920, 1080);
    cpuTimes.push(performance.now() - cpuStart);
  }
  
  const gpuAvg = gpuTimes.reduce((a, b) => a + b) / gpuTimes.length;
  const cpuAvg = cpuTimes.reduce((a, b) => a + b) / cpuTimes.length;
  
  console.log(`GPU average: ${gpuAvg.toFixed(2)}ms`);
  console.log(`CPU average: ${cpuAvg.toFixed(2)}ms`);
  console.log(`Speedup: ${(cpuAvg / gpuAvg).toFixed(2)}x`);
}

runBenchmark();
