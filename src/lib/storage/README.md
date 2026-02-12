# Storage Module

This module provides persistent storage and JSON export/import functionality for Napkin.

## Features

- **IndexedDB Auto-save**: Automatic saving to browser's IndexedDB
- **JSON Export/Import**: Portable document format for file sharing
- **Schema Validation**: Type-safe document structure
- **Debounced Saves**: Efficient auto-save with debouncing

## Usage

### IndexedDB Auto-save

```typescript
import { saveAutosave, loadAutosave, debounce } from '@/lib/storage';
import { canvasStore } from '@/lib/state/canvasStore';

// Load autosave on app startup
const savedDoc = await loadAutosave();
if (savedDoc) {
  const state = deserializeCanvasState(savedDoc);
  canvasStore.loadState(state);
}

// Setup auto-save with debouncing (2-3 seconds recommended)
const debouncedSave = debounce(async (state) => {
  const document = serializeCanvasState(state);
  await saveAutosave(document);
}, 2000);

// Subscribe to state changes
canvasStore.subscribe((state) => {
  debouncedSave(state);
});
```

### JSON Export/Import

```typescript
import { downloadJSON, uploadJSON, exportToJSON, importFromJSON } from '@/lib/storage';

// Export to JSON file
function handleExport() {
  const state = get(canvasStore);
  downloadJSON(state, 'my-diagram.json');
}

// Import from JSON file
async function handleImport() {
  try {
    const state = await uploadJSON();
    canvasStore.loadState(state);
  } catch (error) {
    console.error('Failed to import:', error);
  }
}

// Copy/paste via clipboard
import { copyToClipboard, pasteFromClipboard } from '@/lib/storage';

async function handleCopy() {
  const state = get(canvasStore);
  await copyToClipboard(state);
}

async function handlePaste() {
  const state = await pasteFromClipboard();
  if (state) {
    canvasStore.loadState(state);
  }
}
```

### Schema

```typescript
interface ExcaliDocument {
  version: string;           // "1.0.0"
  appName: string;          // "napkin"
  shapes: SerializedShape[]; // Array of shapes
  viewport: Viewport;        // Pan/zoom state
  metadata: {
    created: string;         // ISO timestamp
    modified: string;        // ISO timestamp
    title?: string;
    description?: string;
  };
}
```

## File Structure

- `indexedDB.ts` - IndexedDB wrapper with save/load functions
- `jsonExport.ts` - JSON serialization/deserialization
- `schema.ts` - Document schema and validation
- `index.ts` - Module exports

## Implementation Details

### IndexedDB Configuration

- **Database Name**: `napkin`
- **Store Name**: `documents`
- **Autosave Key**: `autosave`
- **Version**: 1

### Serialization

The module handles conversion between:
- Runtime shapes (with Map and methods) → Serialized shapes (plain objects)
- Canvas state → ExcaliDocument format
- Preserves shape properties, viewport state, and metadata

### Error Handling

All functions throw descriptive errors for:
- Invalid JSON format
- Schema validation failures
- IndexedDB operation failures
- File system errors
