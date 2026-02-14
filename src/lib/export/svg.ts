/**
 * SVG export functionality
 * Renders on main thread using rough.js for pixel-perfect match with canvas
 * Creates an SVG that embeds a high-resolution canvas rendering
 */

import type { Shape, Viewport } from '../types';
import { getContentBounds, renderShapesToCanvas } from './renderExport';
import { isTauri } from '../storage/tauriFile';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

export interface ExportSVGOptions {
  backgroundColor?: string;
  filename?: string;
  padding?: number;
  scale?: number;
}

const MAX_CANVAS_DIM = 8192;

/**
 * Export shapes to SVG
 * Renders shapes using rough.js on a canvas, then embeds as a high-res image in SVG
 */
export async function exportToSVG(
  shapes: Shape[],
  _viewport: Viewport,
  options: ExportSVGOptions = {}
): Promise<void> {
  const {
    backgroundColor = '#ffffff',
    filename = 'napkin-export.svg',
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

  const maxScale = Math.min(
    MAX_CANVAS_DIM / contentWidth,
    MAX_CANVAS_DIM / contentHeight,
    scale
  );
  scale = Math.max(1, maxScale);

  const canvasWidth = Math.ceil(contentWidth * scale);
  const canvasHeight = Math.ceil(contentHeight * scale);

  // Create offscreen canvas and render
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvasWidth;
  exportCanvas.height = canvasHeight;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.scale(scale, scale);
  ctx.translate(-bounds.minX + padding, -bounds.minY + padding);

  try {
    await renderShapesToCanvas(ctx, exportCanvas, shapes);
  } catch (renderErr) {
    console.error('Export render failed:', renderErr);
    throw new Error(`Render failed: ${renderErr instanceof Error ? renderErr.message : String(renderErr)}`);
  }

  // Convert canvas to data URL and embed in SVG
  const dataURL = exportCanvas.toDataURL('image/png');
  const svgWidth = Math.ceil(contentWidth);
  const svgHeight = Math.ceil(contentHeight);

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <image width="${svgWidth}" height="${svgHeight}" xlink:href="${dataURL}"/>
</svg>`;

  const blob = new Blob([svgString], { type: 'image/svg+xml' });

  if (isTauri()) {
    try {
      const filePath = await save({
        defaultPath: filename,
        filters: [{ name: 'SVG Image', extensions: ['svg'] }],
      });

      if (filePath) {
        await writeTextFile(filePath, svgString);
      }
    } catch (tauriErr) {
      console.error('Tauri save failed:', tauriErr);
      throw new Error(`Save failed: ${tauriErr instanceof Error ? tauriErr.message : String(tauriErr)}`);
    }
  } else {
    downloadBlob(blob, filename);
  }
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
