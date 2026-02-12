/**
 * PNG export functionality
 * Renders on main thread using rough.js for pixel-perfect match with canvas
 */

import type { Shape, Viewport } from '../types';
import { getContentBounds, renderShapesToCanvas } from './renderExport';
import { isTauri } from '../storage/tauriFile';

export interface ExportPNGOptions {
  backgroundColor?: string;
  filename?: string;
  padding?: number;
  scale?: number;
}

// Max canvas dimension to avoid browser limits
const MAX_CANVAS_DIM = 8192;

/**
 * Export shapes to PNG
 * Renders all shapes using the same rough.js pipeline as the main canvas
 */
export async function exportToPNG(
  shapes: Shape[],
  _viewport: Viewport,
  options: ExportPNGOptions = {}
): Promise<void> {
  const {
    backgroundColor = '#ffffff',
    filename = 'napkin-export.png',
    padding = 40,
  } = options;
  let { scale = 2 } = options;

  if (shapes.length === 0) {
    throw new Error('Nothing to export');
  }

  // Calculate content bounds
  const bounds = getContentBounds(shapes);
  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;

  // Clamp scale if canvas would exceed browser limits
  const maxScale = Math.min(
    MAX_CANVAS_DIM / contentWidth,
    MAX_CANVAS_DIM / contentHeight,
    scale
  );
  scale = Math.max(1, maxScale);

  const canvasWidth = Math.ceil(contentWidth * scale);
  const canvasHeight = Math.ceil(contentHeight * scale);

  // Create offscreen canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvasWidth;
  exportCanvas.height = canvasHeight;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Scale for resolution, then translate so content fits in canvas
  ctx.scale(scale, scale);
  ctx.translate(-bounds.minX + padding, -bounds.minY + padding);

  // Render all shapes using the same rough.js rendering as the main canvas
  try {
    await renderShapesToCanvas(ctx, exportCanvas, shapes);
  } catch (renderErr) {
    console.error('Export render failed:', renderErr);
    throw new Error(`Render failed: ${renderErr instanceof Error ? renderErr.message : String(renderErr)}`);
  }

  // Convert to blob
  const blob = await canvasToBlob(exportCanvas);
  if (!blob) {
    throw new Error('Failed to create PNG blob');
  }

  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      const filePath = await save({
        defaultPath: filename,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });

      if (filePath) {
        const buffer = await blob.arrayBuffer();
        await writeFile(filePath, new Uint8Array(buffer));
      }
    } catch (tauriErr) {
      console.error('Tauri save failed:', tauriErr);
      throw new Error(`Save failed: ${tauriErr instanceof Error ? tauriErr.message : String(tauriErr)}`);
    }
  } else {
    downloadBlob(blob, filename);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
