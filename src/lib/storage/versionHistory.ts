/**
 * Version history: auto-snapshot with delta compression
 */

import type {
  NapkinDocument,
  SerializedShape,
  VersionHistory,
  VersionSnapshot,
  SnapshotDelta,
  DocumentDelta,
  Viewport,
} from './schema';

const DEFAULT_MAX_SNAPSHOTS = 50;
const DEFAULT_BASELINE_INTERVAL = 10;

/**
 * Create an empty version history
 */
export function createEmptyHistory(): VersionHistory {
  return {
    maxSnapshots: DEFAULT_MAX_SNAPSHOTS,
    baselineInterval: DEFAULT_BASELINE_INTERVAL,
    snapshots: [],
  };
}

/**
 * Simple string hash for change detection
 */
function hashDocuments(docs: NapkinDocument[]): string {
  const parts: string[] = [];
  for (const doc of docs) {
    parts.push(doc.metadata?.title || '');
    for (const shape of doc.shapes) {
      parts.push(shape.id);
      parts.push(JSON.stringify(shape));
    }
    parts.push('---');
  }
  // Simple djb2-style hash
  let hash = 5381;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Compute the delta between two documents (old → new)
 */
function computeDocumentDelta(
  oldDoc: NapkinDocument,
  newDoc: NapkinDocument,
  index: number
): DocumentDelta | null {
  const oldMap = new Map<string, SerializedShape>();
  for (const s of oldDoc.shapes) oldMap.set(s.id, s);

  const newMap = new Map<string, SerializedShape>();
  for (const s of newDoc.shapes) newMap.set(s.id, s);

  const added: SerializedShape[] = [];
  const removed: string[] = [];
  const modified: Array<{ id: string; changes: Record<string, any> }> = [];

  // Find added and modified
  for (const [id, newShape] of newMap) {
    const oldShape = oldMap.get(id);
    if (!oldShape) {
      added.push(newShape);
    } else {
      const changes: Record<string, any> = {};
      const allKeys = new Set([...Object.keys(oldShape), ...Object.keys(newShape)]);
      for (const key of allKeys) {
        const oldVal = (oldShape as any)[key];
        const newVal = (newShape as any)[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes[key] = newVal === undefined ? null : newVal;
        }
      }
      if (Object.keys(changes).length > 0) {
        modified.push({ id, changes });
      }
    }
  }

  // Find removed
  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) {
      removed.push(id);
    }
  }

  // Check viewport change
  let viewport: Viewport | undefined;
  if (
    oldDoc.viewport.x !== newDoc.viewport.x ||
    oldDoc.viewport.y !== newDoc.viewport.y ||
    oldDoc.viewport.zoom !== newDoc.viewport.zoom
  ) {
    viewport = newDoc.viewport;
  }

  if (added.length === 0 && removed.length === 0 && modified.length === 0 && !viewport) {
    return null;
  }

  return { index, added, removed, modified, viewport };
}

/**
 * Apply a document delta to reconstruct state
 */
function applyDocumentDelta(doc: NapkinDocument, delta: DocumentDelta): NapkinDocument {
  const shapeMap = new Map<string, SerializedShape>();
  for (const s of doc.shapes) shapeMap.set(s.id, { ...s });

  // Remove
  for (const id of delta.removed) {
    shapeMap.delete(id);
  }

  // Modify
  for (const mod of delta.modified) {
    const existing = shapeMap.get(mod.id);
    if (existing) {
      const updated = { ...existing };
      for (const [key, value] of Object.entries(mod.changes)) {
        if (value === null) {
          delete (updated as any)[key];
        } else {
          (updated as any)[key] = value;
        }
      }
      shapeMap.set(mod.id, updated);
    }
  }

  // Add
  for (const shape of delta.added) {
    shapeMap.set(shape.id, shape);
  }

  // Rebuild shapes array preserving order: existing (minus removed) + added
  const existingOrder = doc.shapes
    .filter(s => shapeMap.has(s.id))
    .map(s => shapeMap.get(s.id)!);
  const addedIds = new Set(delta.added.map(s => s.id));
  const ordered = [
    ...existingOrder,
    ...delta.added.filter(s => !existingOrder.some(e => e.id === s.id)),
  ];

  return {
    ...doc,
    shapes: ordered,
    viewport: delta.viewport || doc.viewport,
  };
}

/**
 * Generate a human-readable summary of changes
 */
function generateSummary(deltas: DocumentDelta[], docCount: number): string {
  if (deltas.length === 0) return 'No changes';

  const parts: string[] = [];
  for (const delta of deltas) {
    const items: string[] = [];
    if (delta.added.length > 0) items.push(`+${delta.added.length}`);
    if (delta.removed.length > 0) items.push(`-${delta.removed.length}`);
    if (delta.modified.length > 0) items.push(`~${delta.modified.length}`);
    if (items.length > 0) {
      const label = docCount > 1 ? `Tab ${delta.index + 1}: ` : '';
      parts.push(`${label}${items.join(', ')} shapes`);
    }
  }

  return parts.join('; ') || 'Minor changes';
}

/**
 * Reconstruct the full state at a given snapshot index
 */
export function reconstructState(
  history: VersionHistory,
  snapshotIndex: number
): NapkinDocument[] {
  const snapshot = history.snapshots[snapshotIndex];
  if (!snapshot) throw new Error(`Snapshot index ${snapshotIndex} out of range`);

  // If it's a baseline, return directly
  if (snapshot.fullState) {
    return snapshot.fullState.map(doc => ({
      ...doc,
      shapes: [...doc.shapes],
    }));
  }

  // Walk back to find nearest baseline
  let baselineIdx = snapshotIndex - 1;
  while (baselineIdx >= 0 && !history.snapshots[baselineIdx].fullState) {
    baselineIdx--;
  }

  if (baselineIdx < 0) {
    throw new Error('No baseline found before snapshot');
  }

  // Start from baseline
  let state = history.snapshots[baselineIdx].fullState!.map(doc => ({
    ...doc,
    shapes: [...doc.shapes],
  }));

  // Apply deltas forward
  for (let i = baselineIdx + 1; i <= snapshotIndex; i++) {
    const s = history.snapshots[i];
    if (s.fullState) {
      state = s.fullState.map(doc => ({ ...doc, shapes: [...doc.shapes] }));
    } else if (s.delta) {
      for (const docDelta of s.delta.documents) {
        if (docDelta.index < state.length) {
          state[docDelta.index] = applyDocumentDelta(state[docDelta.index], docDelta);
        }
      }
    }
  }

  return state;
}

/**
 * Create a snapshot of the current state, appending to history.
 * Returns updated history (or same reference if no changes detected).
 */
export function createSnapshot(
  currentDocs: NapkinDocument[],
  activeIndex: number,
  history: VersionHistory
): VersionHistory {
  // Check for duplicate via hash
  const currentHash = hashDocuments(currentDocs);
  const lastSnapshot = history.snapshots[history.snapshots.length - 1];
  if (lastSnapshot) {
    const lastState = lastSnapshot.fullState
      ? lastSnapshot.fullState
      : reconstructState(history, history.snapshots.length - 1);
    const lastHash = hashDocuments(lastState);
    if (currentHash === lastHash) {
      return history; // No changes
    }
  }

  const now = new Date();
  const isBaseline =
    history.snapshots.length === 0 ||
    history.snapshots.length % history.baselineInterval === 0;

  const tabTitles = currentDocs.map(doc => doc.metadata?.title || 'Untitled');
  let snapshot: VersionSnapshot;

  if (isBaseline) {
    snapshot = {
      id: `snapshot_${now.getTime()}`,
      timestamp: now.toISOString(),
      summary: history.snapshots.length === 0 ? 'Initial snapshot' : 'Baseline snapshot',
      fullState: currentDocs.map(doc => ({ ...doc, shapes: [...doc.shapes] })),
      activeDocumentIndex: activeIndex,
      tabTitles,
    };
  } else {
    // Compute delta from last snapshot's state
    const prevState = reconstructState(history, history.snapshots.length - 1);
    const deltas: DocumentDelta[] = [];

    const maxLen = Math.max(prevState.length, currentDocs.length);
    for (let i = 0; i < maxLen; i++) {
      const oldDoc = prevState[i] || { version: '1.0.0', appName: 'napkin', shapes: [], viewport: { x: 0, y: 0, zoom: 1 }, metadata: { created: '', modified: '', title: '' } };
      const newDoc = currentDocs[i] || oldDoc;
      const delta = computeDocumentDelta(oldDoc, newDoc, i);
      if (delta) deltas.push(delta);
    }

    const summary = generateSummary(deltas, currentDocs.length);

    snapshot = {
      id: `snapshot_${now.getTime()}`,
      timestamp: now.toISOString(),
      summary,
      delta: { documents: deltas },
      activeDocumentIndex: activeIndex,
      tabTitles,
    };
  }

  const newSnapshots = [...history.snapshots, snapshot];

  // Prune if over limit
  if (newSnapshots.length > history.maxSnapshots) {
    const excess = newSnapshots.length - history.maxSnapshots;
    newSnapshots.splice(0, excess);

    // Ensure oldest remaining is a baseline
    if (newSnapshots.length > 0 && !newSnapshots[0].fullState) {
      const reconstructed = reconstructStateFromArray(newSnapshots, 0);
      newSnapshots[0] = {
        ...newSnapshots[0],
        fullState: reconstructed,
        delta: undefined,
      };
    }
  }

  return {
    ...history,
    snapshots: newSnapshots,
  };
}

/**
 * Reconstruct state at index within a given snapshots array (for pruning)
 */
function reconstructStateFromArray(
  snapshots: VersionSnapshot[],
  targetIndex: number
): NapkinDocument[] {
  const snapshot = snapshots[targetIndex];
  if (snapshot.fullState) {
    return snapshot.fullState.map(doc => ({ ...doc, shapes: [...doc.shapes] }));
  }

  // Find nearest baseline before target
  let baselineIdx = targetIndex - 1;
  while (baselineIdx >= 0 && !snapshots[baselineIdx].fullState) {
    baselineIdx--;
  }

  if (baselineIdx < 0) {
    // No baseline available; this shouldn't happen after proper pruning
    // Return empty state as fallback
    return [];
  }

  let state = snapshots[baselineIdx].fullState!.map(doc => ({
    ...doc,
    shapes: [...doc.shapes],
  }));

  for (let i = baselineIdx + 1; i <= targetIndex; i++) {
    const s = snapshots[i];
    if (s.fullState) {
      state = s.fullState.map(doc => ({ ...doc, shapes: [...doc.shapes] }));
    } else if (s.delta) {
      for (const docDelta of s.delta.documents) {
        if (docDelta.index < state.length) {
          state[docDelta.index] = applyDocumentDelta(state[docDelta.index], docDelta);
        }
      }
    }
  }

  return state;
}
