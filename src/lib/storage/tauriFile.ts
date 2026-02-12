/**
 * Tauri file system integration
 * Provides native file dialogs and file operations for the desktop app
 */

import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Save drawing to file using native dialog.
 * Takes a pre-built JSON string, shows save dialog, writes to file, returns filePath.
 */
export async function saveDrawingFile(json: string): Promise<string | null> {
  if (!isTauri()) {
    throw new Error('Tauri file system not available');
  }

  // Show native save dialog
  let filePath: string | null;
  try {
    filePath = await save({
      defaultPath: 'drawing.napkin',
      filters: [
        {
          name: 'Napkin Drawing',
          extensions: ['napkin', 'json']
        }
      ]
    });
  } catch (dialogError) {
    console.error('Dialog save() failed:', dialogError);
    throw new Error(`Failed to open save dialog: ${dialogError instanceof Error ? dialogError.message : String(dialogError)}`);
  }

  if (!filePath) return null; // User cancelled

  // Write to file
  try {
    await writeTextFile(filePath, json);
  } catch (writeError) {
    console.error('writeTextFile failed for path:', filePath, writeError);
    throw new Error(`Failed to write file: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
  }

  return filePath;
}

/**
 * Save drawing to a specific file path (no dialog).
 * Takes a pre-built JSON string and writes to the specified path.
 */
export async function saveToFile(json: string, filePath: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Tauri file system not available');
  }

  try {
    await writeTextFile(filePath, json);
  } catch (writeError) {
    console.error('writeTextFile failed for path:', filePath, writeError);
    throw new Error(`Failed to write file: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
  }
}

/**
 * Open drawing from file using native dialog.
 * Returns raw JSON string and filePath instead of parsed state.
 */
export async function openDrawingFile(): Promise<{ json: string; filePath: string } | null> {
  if (!isTauri()) {
    throw new Error('Tauri file system not available');
  }

  // Show native open dialog
  const filePath = await open({
    filters: [
      {
        name: 'Napkin Drawing',
        extensions: ['napkin', 'excali', 'json']
      }
    ],
    multiple: false
  });

  if (!filePath || Array.isArray(filePath)) return null; // User cancelled or multiple files

  // Read file
  const json = await readTextFile(filePath as string);

  return { json, filePath: filePath as string };
}

/**
 * Export to PNG using native save dialog
 */
export async function exportPNGFile(canvas: HTMLCanvasElement): Promise<void> {
  if (!isTauri()) {
    throw new Error('Tauri file system not available');
  }

  const filePath = await save({
    defaultPath: 'drawing.png',
    filters: [
      {
        name: 'PNG Image',
        extensions: ['png']
      }
    ]
  });

  if (!filePath) return;

  // Convert canvas to blob
  canvas.toBlob(async (blob) => {
    if (!blob) return;

    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];

      // Decode base64 to binary and write
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Write binary data to file
      await writeTextFile(filePath, String.fromCharCode(...bytes));
    };
    reader.readAsDataURL(blob);
  }, 'image/png');
}

/**
 * Export to SVG using native save dialog
 */
export async function exportSVGFile(svgContent: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Tauri file system not available');
  }

  const filePath = await save({
    defaultPath: 'drawing.svg',
    filters: [
      {
        name: 'SVG Image',
        extensions: ['svg']
      }
    ]
  });

  if (!filePath) return;

  await writeTextFile(filePath, svgContent);
}
