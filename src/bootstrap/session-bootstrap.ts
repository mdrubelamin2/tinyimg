import { getPool } from '@/services/worker-coordinator'
import { clearSessionStorage } from '@/storage/hybrid-storage'
import { requestPersistence } from '@/storage/quota'
import { preloadThumbnailWorker } from '@/thumbnails/thumbnail-generator'
import 'scheduler-polyfill'

export async function bootstrapSession(): Promise<void> {
  await requestPersistence()
  await clearSessionStorage()

  scheduler.postTask(
    () => {
      preloadThumbnailWorker()
      getPool().warmup()
    },
    {
      delay: 150,
      priority: 'background',
    },
  )
}
