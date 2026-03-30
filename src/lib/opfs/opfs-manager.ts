import {
  OPFS_ROOT_DIR,
  OPFS_ORIGINALS_DIR,
  OPFS_THUMBNAILS_DIR,
} from '../../constants/index.js';

export class OPFSManager {
  private root: FileSystemDirectoryHandle | null = null;
  private originalsDir: FileSystemDirectoryHandle | null = null;
  private thumbnailsDir: FileSystemDirectoryHandle | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      this.root = await opfsRoot.getDirectoryHandle(OPFS_ROOT_DIR, { create: true });
      this.originalsDir = await this.root.getDirectoryHandle(OPFS_ORIGINALS_DIR, { create: true });
      this.thumbnailsDir = await this.root.getDirectoryHandle(OPFS_THUMBNAILS_DIR, { create: true });
      this.initialized = true;
    } catch (error) {
      throw new Error(`OPFS initialization failed: ${error}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async writeFile(file: File, id: string): Promise<FileSystemFileHandle> {
    if (!this.originalsDir) throw new Error('OPFS not initialized');
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${id}.${ext}`;
    const fileHandle = await this.originalsDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return fileHandle;
  }

  async readFile(handle: FileSystemFileHandle): Promise<File> {
    return await handle.getFile();
  }

  async deleteFile(handle: FileSystemFileHandle): Promise<void> {
    if (!this.originalsDir) throw new Error('OPFS not initialized');
    try {
      await this.originalsDir.removeEntry(handle.name);
    } catch (error) {
      console.warn('Failed to delete file from OPFS:', error);
    }
  }

  async writeThumbnail(id: string, blob: Blob): Promise<FileSystemFileHandle> {
    if (!this.thumbnailsDir) throw new Error('OPFS not initialized');
    const fileName = `${id}.webp`;
    const fileHandle = await this.thumbnailsDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return fileHandle;
  }

  async readThumbnail(id: string): Promise<File | null> {
    if (!this.thumbnailsDir) return null;
    try {
      const fileName = `${id}.webp`;
      const fileHandle = await this.thumbnailsDir.getFileHandle(fileName);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  async deleteThumbnail(id: string): Promise<void> {
    if (!this.thumbnailsDir) return;
    try {
      await this.thumbnailsDir.removeEntry(`${id}.webp`);
    } catch (error) {
      console.warn('Failed to delete thumbnail from OPFS:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.root) return;
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      await opfsRoot.removeEntry(OPFS_ROOT_DIR, { recursive: true });
      this.root = null;
      this.originalsDir = null;
      this.thumbnailsDir = null;
      this.initialized = false;
    } catch (error) {
      console.warn('OPFS cleanup failed:', error);
    }
  }
}

export const opfsManager = new OPFSManager();