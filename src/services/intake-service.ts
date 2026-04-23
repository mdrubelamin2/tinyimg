import { batch } from '@legendapp/state';
import { toast } from 'sonner';
import {
  ERR_ZIP_EXCEEDS_LIMIT,
  ERR_INTAKE_STORAGE_FULL,
  INTAKE_UI_CHUNK,
  INTAKE_PERSIST_CONCURRENCY
} from '@/constants';
import { imageStore$, intake$ } from '@/store/queue-store';
import {
  iterateIntakeEntries,
  normalizeIntakeSources,
  type CollectIntakeEntry,
  type IntakeOriginalKind,
} from '@/lib/queue/queue-intake';
import { registerDirectDropOriginal } from '@/storage/dropped-original-files';
import { persistBufferedOriginalSource } from '@/storage/queue-binary';
import { isQuotaExceededError } from '@/storage/quota';
import { createQueueItem } from '@/lib/queue/queue-item';
import { enqueueThumbnails } from '@/thumbnails/thumbnail-generator';
import type { GlobalOptions } from '@/constants';

async function persistIntakeOriginalsParallel(chunk: CollectIntakeEntry[]): Promise<void> {
  const todo = chunk.filter(e => e.intakeOriginal);
  for (let k = 0; k < todo.length; k += INTAKE_PERSIST_CONCURRENCY) {
    const slice = todo.slice(k, k + INTAKE_PERSIST_CONCURRENCY);
    await Promise.all(
      slice.map(async (ent) => {
        const o = ent.intakeOriginal!;
        if (o.kind === 'buffered-session') return;
        if (o.kind === 'direct') {
          registerDirectDropOriginal(ent.item.id, o.file);
        } else {
          await persistBufferedOriginalSource(ent.item.id, o.file);
        }
      })
    );
  }
}

const mergeChunkToStore = (chunk: CollectIntakeEntry[]) => {
  batch(() => {
    const order = [...imageStore$.itemOrder.peek()];
    const orderSet = new Set(order);

    for (const ent of chunk) {
      imageStore$.items[ent.item.id]!.set(ent.item);
      if (!orderSet.has(ent.item.id)) {
        order.push(ent.item.id);
        orderSet.add(ent.item.id);
      }
    }
    imageStore$.itemOrder.set(order);
  });
  enqueueThumbnails(chunk.map(e => e.item.id));
};

export async function addFiles(
  files: FileList | File[] | DataTransferItemList | DataTransferItem[],
  options: GlobalOptions
): Promise<void> {
  batch(() => {
    intake$.active.set(true);
    intake$.phase.set('collecting');
    intake$.label.set('Scanning dropped items…');
    intake$.processed.set(0);
    intake$.total.set(0);
  });

  try {
    const source = await normalizeIntakeSources(files);
    const zipIntakeState = { depth: 0 };

    const ctx = {
      createItem: (file: File, intakeKind: IntakeOriginalKind, dimensions?: { width: number; height: number }) =>
        createQueueItem(file, options, intakeKind, dimensions),
      onExtractingArchive: (archiveName: string) => {
        batch(() => {
          intake$.label.set(`Reading ${archiveName}…`);
        });
      },
      onZipManifest: (archiveName: string, entryCount: number) => {
        zipIntakeState.depth += 1;
        batch(() => {
          intake$.label.set(`Extracting ${archiveName}…`);
          intake$.total.set(entryCount);
          intake$.processed.set(0);
        });
      },
      onZipProgress: (processed: number, total: number) => {
        batch(() => {
          intake$.processed.set(processed);
          intake$.total.set(total);
        });
      },
      onZipStreamEnd: () => {
        zipIntakeState.depth = Math.max(0, zipIntakeState.depth - 1);
        if (zipIntakeState.depth === 0) {
          batch(() => {
            intake$.total.set(0);
            intake$.processed.set(0);
          });
        }
      },
      onZipArchiveOversized: (fileName: string) => {
        toast.error(`${fileName}: ${ERR_ZIP_EXCEEDS_LIMIT}`, { id: 'zip-archive-oversized' });
      },
    };

    const buffer: CollectIntakeEntry[] = [];

    const flushBuffer = async () => {
      if (buffer.length === 0) return;
      const chunk = buffer.splice(0, buffer.length);
      await persistIntakeOriginalsParallel(chunk);
      mergeChunkToStore(chunk);
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });
    };

    batch(() => {
      intake$.phase.set('merging');
      intake$.label.set('Adding to queue…');
    });

    try {
      for await (const ent of iterateIntakeEntries(source, ctx)) {
        if (zipIntakeState.depth > 0) {
          await persistIntakeOriginalsParallel([ent]);
          mergeChunkToStore([ent]);
          await new Promise<void>(resolve => {
            requestAnimationFrame(() => resolve());
          });
        } else {
          buffer.push(ent);
          if (buffer.length >= INTAKE_UI_CHUNK) {
            await flushBuffer();
          }
        }
      }

      await flushBuffer();
    } catch (err) {
      if (isQuotaExceededError(err)) {
        toast.error(ERR_INTAKE_STORAGE_FULL, { id: 'intake-storage-full' });
        buffer.length = 0;
      } else {
        throw err;
      }
    }
  } finally {
    setTimeout(() => {
      batch(() => {
        intake$.active.set(false);
        intake$.phase.set('idle');
        intake$.label.set('');
        intake$.processed.set(0);
        intake$.total.set(0);
      });
    }, 500);
  }
}
