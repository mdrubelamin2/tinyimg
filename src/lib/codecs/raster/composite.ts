/** Alpha pre-multiplication on white background (canvas path). */

export async function compositeImageDataOnWhite(imageData: ImageData): Promise<ImageData> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2d context for composite');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, imageData.width, imageData.height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.putImageData(imageData, 0, 0);

    return ctx.getImageData(0, 0, imageData.width, imageData.height);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
