import { clearSessionStorage } from '@/storage/hybrid-storage';
import { clearDirectDropOriginals } from '@/storage/dropped-original-files';
import { requestPersistence } from '@/storage/quota';

export async function bootstrapSession(): Promise<void> {
  await clearSessionStorage();
  clearDirectDropOriginals();
  void requestPersistence();
}

document.addEventListener('DOMContentLoaded', () => {
  void bootstrapSession();
});
