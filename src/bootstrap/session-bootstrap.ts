import { clearSessionStorage } from '@/storage/hybrid-storage';
import { clearDirectDropOriginals } from '@/storage/dropped-original-files';

export async function bootstrapSession(): Promise<void> {
  await clearSessionStorage();
  clearDirectDropOriginals();
}
