/**
 * Image shape - embeds images on the canvas
 */

import type { BoundingBox, ImageShape } from '../types';
import { generateShapeId } from '../state/canvasStore';

export type { ImageShape };

/**
 * Load an image and return HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Convert a File to a data URL
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a Blob to a data URL
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Create an image shape from a file
 */
export async function createImageFromFile(
  file: File,
  x: number,
  y: number
): Promise<ImageShape> {
  const dataURL = await fileToDataURL(file);
  const img = await loadImage(dataURL);

  // Calculate dimensions while maintaining aspect ratio
  const maxWidth = 800;
  const maxHeight = 600;
  let width = img.width;
  let height = img.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = width * ratio;
    height = height * ratio;
  }

  return {
    id: generateShapeId(),
    type: 'image' as const,
    x,
    y,
    width,
    height,
    src: dataURL,
    opacity: 1,
    imageElement: img,
    loaded: true,
    strokeColor: '#000000',
    strokeWidth: 0,
    fillColor: 'transparent',
  };
}

/**
 * Create an image shape from a data URL
 */
export async function createImageFromURL(
  src: string,
  x: number,
  y: number
): Promise<ImageShape> {
  const img = await loadImage(src);

  // Calculate dimensions while maintaining aspect ratio
  const maxWidth = 800;
  const maxHeight = 600;
  let width = img.width;
  let height = img.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = width * ratio;
    height = height * ratio;
  }

  return {
    id: generateShapeId(),
    type: 'image' as const,
    x,
    y,
    width,
    height,
    src,
    opacity: 1,
    imageElement: img,
    loaded: true,
    strokeColor: '#000000',
    strokeWidth: 0,
    fillColor: 'transparent',
  };
}

/**
 * Render an image shape
 */
export function renderImage(
  ctx: CanvasRenderingContext2D,
  shape: ImageShape
): void {
  if (!shape.loaded || !shape.imageElement) {
    // Show placeholder
    ctx.save();
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);

    // Draw "loading" text
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Loading...',
      shape.x + shape.width / 2,
      shape.y + shape.height / 2
    );
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = shape.opacity;

  try {
    ctx.drawImage(
      shape.imageElement,
      shape.x,
      shape.y,
      shape.width,
      shape.height
    );
  } catch (error) {
    console.error('Error rendering image:', error);
    // Show error placeholder
    ctx.fillStyle = '#ffebee';
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 2;
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
  }

  ctx.restore();
}

/**
 * Get bounding box for an image
 */
export function getImageBounds(shape: ImageShape): BoundingBox {
  return {
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height
  };
}

/**
 * Check if a point is inside an image
 */
export function imageContainsPoint(
  shape: ImageShape,
  x: number,
  y: number
): boolean {
  return (
    x >= shape.x &&
    x <= shape.x + shape.width &&
    y >= shape.y &&
    y <= shape.y + shape.height
  );
}

/**
 * Handle paste event for images
 */
export async function handleImagePaste(
  event: ClipboardEvent,
  centerX: number = 100,
  centerY: number = 100
): Promise<ImageShape | null> {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) {
        const img = await createImageFromFile(blob, centerX, centerY);
        return img;
      }
    }
  }

  return null;
}

/**
 * Handle drop event for images
 */
export async function handleImageDrop(
  event: DragEvent,
  canvasX: number,
  canvasY: number
): Promise<ImageShape | null> {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return null;

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const img = await createImageFromFile(file, canvasX, canvasY);
      return img;
    }
  }

  return null;
}

/**
 * Ensure image is loaded (lazy loading support)
 */
export async function ensureImageLoaded(shape: ImageShape): Promise<void> {
  if (shape.loaded && shape.imageElement) {
    return;
  }

  const img = await loadImage(shape.src);
  shape.imageElement = img;
  shape.loaded = true;
}
