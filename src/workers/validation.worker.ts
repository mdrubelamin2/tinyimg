/**
 * Validation worker - offloads file validation to prevent blocking main thread
 * Especially important when dropping 1000+ files at once
 */

import { detectFileTypeFromBuffer } from '@/lib/validation';
import { isValidImageExtension, MAX_FILE_SIZE_BYTES } from '@/constants';

interface ValidationRequest {
  id: string;
  file: File;
}

interface ValidationResponse {
  id: string;
  valid: boolean;
  detected?: { ext: string; mime: string };
  error?: string;
}

const FILE_HEADER_READ_LENGTH = 4100;

self.onmessage = async (e: MessageEvent<ValidationRequest>) => {
  const { id, file } = e.data;

  try {
    // Check file size first (fast)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const response: ValidationResponse = {
        id,
        valid: false,
        error: 'File exceeds size limit',
      };
      self.postMessage(response);
      return;
    }

    // Read file header and detect type
    const buffer = await file.slice(0, FILE_HEADER_READ_LENGTH).arrayBuffer();
    const detected = await detectFileTypeFromBuffer(new Uint8Array(buffer));

    if (!detected || !isValidImageExtension(detected.ext)) {
      const response: ValidationResponse = {
        id,
        valid: false,
        error: 'Invalid file type',
      };
      self.postMessage(response);
      return;
    }

    // Valid file
    const response: ValidationResponse = {
      id,
      valid: true,
      detected,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ValidationResponse = {
      id,
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
    self.postMessage(response);
  }
};
