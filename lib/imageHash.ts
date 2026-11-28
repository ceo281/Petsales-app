import { Jimp } from "jimp";

/**
 * Difference hash (dHash): a 64-bit fingerprint of an image's structure.
 * Two copies of the same photo (resized, recompressed, lightly cropped)
 * land within a few bits of each other; two different photos of the same
 * breed do not. Used to keep Google Lens "looks similar" results from being
 * reported as stolen photos.
 */
export async function dHash(src: string | Buffer): Promise<bigint | null> {
  try {
    const input =
      typeof src === "string" && src.startsWith("data:")
        ? Buffer.from(src.split(",")[1], "base64")
        : typeof src === "string"
          ? Buffer.from(await (await fetch(src, { signal: AbortSignal.timeout(6000) })).arrayBuffer())
          : src;
    const img = await Jimp.read(input);
    img.greyscale().resize({ w: 9, h: 8 });
    const { data, width } = img.bitmap;
    let hash = 0n;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = data[(y * width + x) * 4];
        const right = data[(y * width + x + 1) * 4];
        hash = (hash << 1n) | (left > right ? 1n : 0n);
      }
    }
    return hash;
  } catch {
    return null;
  }
}

export function hamming(a: bigint, b: bigint) {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Bits that may differ for two images to still count as the same photo. */
export const SAME_PHOTO_MAX_DISTANCE = 8;
