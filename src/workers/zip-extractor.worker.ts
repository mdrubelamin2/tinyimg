import { unzip } from 'fflate';
import { isValidImageExtension } from '@/constants';
import { checkMagicBytesFromBuffer } from '@/lib/validation';

interface ZipExtractionRequest {
  data: Uint8Array;
}

interface ZipExtractionResponse {
  files?: Array<{ name: string; data: Uint8Array }>;
  error?: string;
}

self.onmessage = async (e: MessageEvent<ZipExtractionRequest>) => {
  const { data } = e.data;

  try {
    unzip(data, async (err, unzipped) => {
      if (err) {
        const response: ZipExtractionResponse = { error: err.message };
        self.postMessage(response);
        return;
      }

      const files: Array<{ name: string; data: Uint8Array }> = [];

      // Process files sequentially to handle async validation
      for (const [path, bytes] of Object.entries(unzipped)) {
        // Skip directories and hidden files
        if (path.endsWith('/') || path.includes('__MACOSX') || path.startsWith('.')) {
          continue;
        }

        // Extract filename from path
        const name = path.split('/').pop() || path;
        const ext = name.split('.').pop()?.toLowerCase() ?? '';

        // Validate extension
        if (!isValidImageExtension(ext)) {
          continue;
        }

        // Validate magic bytes (now async)
        const isValid = await checkMagicBytesFromBuffer(bytes, ext);
        if (!isValid) {
          continue;
        }

        files.push({ name, data: bytes });
      }

      const response: ZipExtractionResponse = { files };
      self.postMessage(response);
    });
  } catch (error) {
    const response: ZipExtractionResponse = {
      error: error instanceof Error ? error.message : 'Unknown error during ZIP extraction'
    };
    self.postMessage(response);
  }
};
