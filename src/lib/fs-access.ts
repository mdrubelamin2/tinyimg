import { mimeForOutputFormat } from '@/constants';

export const OPEN_IMAGE_AND_ZIP_TYPES: {
  description: string;
  accept: Record<string, string[]>;
}[] = [
  {
    description: 'Images and ZIP archives',
    accept: {
      'image/*': ['.svg', '.png', '.webp', '.avif', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif'],
      'application/zip': ['.zip'],
    },
  },
];

/** NFSA's open picker polyfill reads `accepts` (extensions/mimeTypes), not W3C `types`. */
function w3cTypesToNfsaAccepts(
  types: { description: string; accept: Record<string, string[]> }[]
): { extensions: string[]; mimeTypes: string[] }[] {
  return types.map((t) => ({
    mimeTypes: Object.keys(t.accept),
    extensions: Object.values(t.accept)
      .flat()
      .map((ext) => ext.replace(/^\./, '')),
  }));
}

export function savePickerTypesForImageOutput(format: string): { description: string; accept: Record<string, string[]> }[] {
  const mime = mimeForOutputFormat(format);
  const ext =
    format === 'jpeg' || format === 'jpg' ? '.jpg' : format === 'svg' ? '.svg' : `.${format}`;
  return [{ description: 'Image', accept: { [mime]: [ext] } }];
}

export const SAVE_PICKER_TYPES_ZIP: { description: string; accept: Record<string, string[]> }[] = [
  { description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } },
];

type Nfsa = typeof import('native-file-system-adapter');
let cached: Nfsa | null = null;

async function nfsa(): Promise<Nfsa> {
  if (!cached) cached = await import('native-file-system-adapter');
  return cached;
}

export async function openFilesWithNfsa(options: {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: { description: string; accept: Record<string, string[]> }[];
}): Promise<import('native-file-system-adapter').FileSystemFileHandle[]> {
  const { showOpenFilePicker } = await nfsa();
  const payload = {
    multiple: options.multiple ?? true,
    ...(options.excludeAcceptAllOption !== undefined
      ? { excludeAcceptAllOption: options.excludeAcceptAllOption }
      : {}),
    ...(options.types !== undefined
      ? {
          types: options.types,
          accepts: w3cTypesToNfsaAccepts(options.types),
        }
      : {}),
  } as Parameters<typeof showOpenFilePicker>[0];
  return showOpenFilePicker(payload);
}

export async function saveFileWithNfsa(options: {
  suggestedName: string;
  types?: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption?: boolean;
}): Promise<import('native-file-system-adapter').FileSystemFileHandle> {
  const { showSaveFilePicker } = await nfsa();
  const payload: Parameters<typeof showSaveFilePicker>[0] = {
    suggestedName: options.suggestedName,
  };
  if (options.types !== undefined) payload.types = options.types;
  if (options.excludeAcceptAllOption !== undefined) {
    payload.excludeAcceptAllOption = options.excludeAcceptAllOption;
  }
  return showSaveFilePicker(payload);
}
