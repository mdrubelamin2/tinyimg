/** Alpha pre-multiplication on white background (canvas path). */

export async function compositeImageDataOnWhite(imageData: ImageData): Promise<ImageData> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context for composite');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, imageData.width, imageData.height);

  const bitmap = await createImageBitmap(imageData);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return ctx.getImageData(0, 0, imageData.width, imageData.height);
}
