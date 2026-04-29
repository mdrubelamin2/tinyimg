import { mimeForOutputFormat } from '@/constants'

export const OPEN_IMAGE_AND_ZIP_TYPES: {
  accept: Record<string, string[]>
  description: string
}[] = [
  {
    accept: {
      'application/zip': ['.zip'],
      'image/*': [
        '.svg',
        '.png',
        '.webp',
        '.avif',
        '.jpg',
        '.jpeg',
        '.gif',
        '.bmp',
        '.tif',
        '.tiff',
        '.heic',
        '.heif',
      ],
    },
    description: 'Images and ZIP archives',
  },
]

export function savePickerTypesForImageOutput(
  format: string,
): { accept: Record<string, string[]>; description: string }[] {
  const mime = mimeForOutputFormat(format)
  const ext =
    format === 'jpeg' || format === 'jpg' ? '.jpg' : format === 'svg' ? '.svg' : `.${format}`
  return [{ accept: { [mime]: [ext] }, description: 'Image' }]
}

/** NFSA's open picker polyfill reads `accepts` (extensions/mimeTypes), not W3C `types`. */
function w3cTypesToNfsaAccepts(
  types: { accept: Record<string, string[]>; description: string }[],
): { extensions: string[]; mimeTypes: string[] }[] {
  return types.map((t) => ({
    extensions: Object.values(t.accept)
      .flat()
      .map((ext) => ext.replace(/^\./, '')),
    mimeTypes: Object.keys(t.accept),
  }))
}

export const SAVE_PICKER_TYPES_ZIP: {
  accept: Record<string, string[]>
  description: string
}[] = [{ accept: { 'application/zip': ['.zip'] }, description: 'ZIP archive' }]

type Nfsa = typeof import('native-file-system-adapter')
let cached: Nfsa | null = null

export async function openFilesWithNfsa(options: {
  excludeAcceptAllOption?: boolean
  multiple?: boolean
  types?: { accept: Record<string, string[]>; description: string }[]
}): Promise<import('native-file-system-adapter').FileSystemFileHandle[]> {
  const { showOpenFilePicker } = await nfsa()
  const payload = {
    multiple: options.multiple ?? true,
    ...(options.excludeAcceptAllOption === undefined
      ? {}
      : { excludeAcceptAllOption: options.excludeAcceptAllOption }),
    ...(options.types === undefined
      ? {}
      : {
          accepts: w3cTypesToNfsaAccepts(options.types),
          types: options.types,
        }),
  } as Parameters<typeof showOpenFilePicker>[0]
  return showOpenFilePicker(payload)
}

export async function saveFileWithNfsa(options: {
  excludeAcceptAllOption?: boolean
  suggestedName: string
  types?: { accept: Record<string, string[]>; description: string }[]
}): Promise<import('native-file-system-adapter').FileSystemFileHandle> {
  const { showSaveFilePicker } = await nfsa()
  const payload: Parameters<typeof showSaveFilePicker>[0] = {
    suggestedName: options.suggestedName,
  }
  if (options.types !== undefined) payload.types = options.types
  if (options.excludeAcceptAllOption !== undefined) {
    payload.excludeAcceptAllOption = options.excludeAcceptAllOption
  }
  return showSaveFilePicker(payload)
}

async function nfsa(): Promise<Nfsa> {
  if (!cached) cached = await import('native-file-system-adapter')
  return cached
}
