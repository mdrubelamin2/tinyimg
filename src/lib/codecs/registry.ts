/**
 * Codec registry: register, lookup, and manage codec plugins.
 * The pipeline uses this registry to find the right encoder for a format,
 * enabling hot-swapping codecs (e.g., MozJPEG → Jpegli) without pipeline changes.
 */

import type { CodecPlugin, ImageFormat } from './types.ts';

const registry = new Map<string, CodecPlugin>();

/** Register a codec plugin. Later registrations for the same id overwrite earlier ones. */
export function registerCodec(plugin: CodecPlugin): void {
  registry.set(plugin.id, plugin);
}

/** Get all registered codecs for a given format, in registration order. */
export function getCodecsForFormat(format: ImageFormat): CodecPlugin[] {
  return Array.from(registry.values()).filter(c => c.format === format);
}

/** Get the preferred (first registered) encoder for a format. */
export function getEncoder(format: ImageFormat): CodecPlugin | undefined {
  return Array.from(registry.values()).find(
    c => c.format === format && c.capabilities.encode
  );
}

/** Get a specific codec by id. */
export function getCodecById(id: string): CodecPlugin | undefined {
  return registry.get(id);
}

/** List all registered codec ids. */
export function listCodecIds(): string[] {
  return Array.from(registry.keys());
}

/** Clear all registrations (useful for testing). */
export function clearRegistry(): void {
  registry.clear();
}

/**
 * Register all default codecs (jSquash-based).
 * Call this once at app startup or worker init.
 */
export function registerDefaultCodecs(): void {
  // Eagerly import codec modules (they lazy-load their WASM internally)
  const codecs: CodecPlugin[] = [];

  // Register will be called after import
  void Promise.all([
    import('./jpeg.codec.ts').then(m => codecs.push(m.default)),
    import('./webp.codec.ts').then(m => codecs.push(m.default)),
    import('./avif.codec.ts').then(m => codecs.push(m.default)),
    import('./png.codec.ts').then(m => codecs.push(m.default)),
    import('./jxl.codec.ts').then(m => codecs.push(m.default)),
  ]).then(() => {
    for (const codec of codecs) {
      registerCodec(codec);
    }
  });
}
