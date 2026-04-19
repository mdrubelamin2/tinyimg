/** Alpha pre-multiplication on white background (canvas path). */

export function compositeImageDataOnWhite(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    // Standard "over" operator on white: C = C_src * a + C_bg * (1 - a)
    // For white background, C_bg is 255.
    out[i] = data[i]! * a + 255 * (1 - a);
    out[i + 1] = data[i + 1]! * a + 255 * (1 - a);
    out[i + 2] = data[i + 2]! * a + 255 * (1 - a);
    out[i + 3] = 255; // opaque
  }

  return new ImageData(out, width, height);
}
