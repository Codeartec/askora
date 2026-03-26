import type { Area } from 'react-easy-crop';

export type AvatarSource =
  | { kind: 'none' }
  | { kind: 'upload'; file: File; previewUrl: string }
  | { kind: 'preset'; url: string; previewUrl: string; suggestedName: string };

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_AVATAR_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const PRESET_AVATARS: Array<{ url: string; name: string }> = [
  { url: '/avatars/astronaut.svg', name: 'astronaut' },
  { url: '/avatars/cat.svg', name: 'cat' },
  { url: '/avatars/fox.svg', name: 'fox' },
  { url: '/avatars/robot.svg', name: 'robot' },
  { url: '/avatars/unicorn.svg', name: 'unicorn' },
  { url: '/avatars/whale.svg', name: 'whale' },
];

export async function createImage(url: string) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  img.src = url;
  return loaded;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create image blob'));
    }, type, quality);
  });
}

/** Rasterizes any decodeable URL (e.g. preset SVG) to PNG for multipart upload; backend only accepts raster MIME types. */
export async function rasterizeImageUrlToPngFile(url: string, baseName: string, size = 512) {
  const image = await createImage(url);
  let iw = image.naturalWidth;
  let ih = image.naturalHeight;
  if (!iw || !ih) {
    iw = 256;
    ih = 256;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.max(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh);

  const blob = await canvasToBlob(canvas, 'image/png');
  return new File([blob], `${baseName}.png`, { type: 'image/png' });
}

export async function cropImageToSquare(previewUrl: string, cropPixels: Area, size = 512) {
  const image = await createImage(previewUrl);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    size,
    size,
  );

  const blob = await canvasToBlob(canvas, 'image/png');
  return blob;
}
