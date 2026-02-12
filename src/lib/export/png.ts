/**
 * PNG export functionality
 * Uses Web Worker to avoid blocking the main thread
 */

import type { Shape, Viewport } from '../types';

// Create worker instance (will be reused)
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./workers/exportWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}

export interface ExportPNGOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  filename?: string;
}

/**
 * Export canvas to PNG
 * @param shapes - Array of shapes to export
 * @param viewport - Current viewport state
 * @param options - Export options
 */
export async function exportToPNG(
  shapes: Shape[],
  viewport: Viewport,
  options: ExportPNGOptions = {}
): Promise<void> {
  const {
    width = 1920,
    height = 1080,
    backgroundColor = '#ffffff',
    filename = 'napkin-export.png'
  } = options;

  return new Promise((resolve, reject) => {
    const exportWorker = getWorker();

    // Set up message handler
    const handleMessage = (event: MessageEvent) => {
      const { type, blob, error } = event.data;

      // Clean up listener
      exportWorker.removeEventListener('message', handleMessage);

      if (type === 'success' && blob) {
        // Trigger download
        downloadBlob(blob, filename);
        resolve();
      } else if (type === 'error') {
        reject(new Error(error || 'PNG export failed'));
      } else {
        reject(new Error('Unexpected response from worker'));
      }
    };

    exportWorker.addEventListener('message', handleMessage);

    // Send export request to worker
    exportWorker.postMessage({
      type: 'png',
      shapes,
      viewport,
      width,
      height,
      backgroundColor
    });
  });
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Cleanup worker when no longer needed
 */
export function cleanupWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
