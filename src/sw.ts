import { defaultCache } from "@serwist/vite/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { downloadZip } from "client-zip";
import { createNfsaAdapter } from "./storage/nfsa-adapter";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// An in-memory map to store ZIP manifests sent from the main thread
interface ManifestItem {
  path: string;
  payloadKey: string;
}

const zipManifests = new Map<string, ManifestItem[]>();

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PREPARE_ZIP_STREAM") {
    const { batchId, manifest } = event.data;
    if (batchId && manifest) {
      zipManifests.set(batchId, manifest);

      // Send acknowledgment back to main thread
      event.ports[0]?.postMessage({ type: 'MANIFEST_READY', batchId });

      // Auto-cleanup if the download is never triggered (e.g. 5 minutes)
      setTimeout(() => {
        zipManifests.delete(batchId);
      }, 5 * 60 * 1000);
    }
  }
});

// Register our custom fetch handler BEFORE Serwist to intercept ZIP downloads
// Use capture phase to ensure we run before Serwist
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!url.pathname.startsWith("/_/download-zip/")) {
    return;
  }

  // Prevent Serwist's fetch handler from running
  event.respondWith((async () => {
    // Drain preload response
    if ('preloadResponse' in event && event.preloadResponse) {
      await event.preloadResponse;
    }

    const parts = url.pathname.split("/");
    const batchId = parts[3] ?? '';
    const filename = parts.slice(4).join("/") || "images.zip";

    const manifest = zipManifests.get(batchId);
    if (!manifest) {
      console.error(`[SW] Manifest not found for batchId: ${batchId}`);
      return new Response("Not Found", { status: 404 });
    }
    zipManifests.delete(batchId);

    try {
      const storage = await createNfsaAdapter();

      // Send diagnostic info to all clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_DIAGNOSTIC',
          message: `Starting ZIP with ${manifest.length} files`
        });
      });

      // Create async generator that yields files as they're retrieved
      async function* fileSource() {
        if (!manifest) {
          console.error('[SW] Manifest is undefined in fileSource');
          return;
        }

        let filesYielded = 0;

        for (const entry of manifest) {
          const fileData = await storage.getBackedFile(entry.payloadKey);

          if (fileData) {
            yield { name: entry.path, input: fileData };
            filesYielded++;

            // Send progress to clients
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
              client.postMessage({
                type: 'SW_DIAGNOSTIC',
                message: `Added ${filesYielded}/${manifest.length} files`
              });
            });
          } else {
            console.warn(`[SW] Missing file: ${entry.path}`);
          }
        }

        // Send final stats to clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_DIAGNOSTIC',
            message: `Complete - ${filesYielded} files zipped`
          });
        });
      }

      const zipOutput = downloadZip(fileSource());

      return new Response(zipOutput.body, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (err) {
      // Send error to clients
      const clients = await self.clients.matchAll();
      const errMsg = err instanceof Error ? err.message : String(err);
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_DIAGNOSTIC',
          message: `SW: ERROR - ${errMsg}`
        });
      });

      return new Response("Streaming Failed", { status: 500 });
    }
  })());
}, true);

// Since we added custom event listeners before Serwist hooks up its own,
// Serwist's caching will only apply to requests that didn't match our custom route.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST || [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});
serwist.addEventListeners();
