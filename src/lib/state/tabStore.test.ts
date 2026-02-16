import { get } from 'svelte/store';
import { tabStore, createTabSilent } from './tabStore';
import { canvasStore, clearCanvas, addShape, type CanvasState } from './canvasStore';
import { historyManager } from './history';
import type { Shape } from '$lib/types';

function makeDefaultCanvasState(): CanvasState {
  return {
    shapes: new Map(),
    shapesArray: [],
    selectedIds: new Set(),
    groups: new Map(),
    viewport: { x: 0, y: 0, zoom: 1 },
    activeTool: 'select',
    stylePreset: {
      strokeColor: '#000000',
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
      roughness: 1,
    },
    showGrid: true,
    snapToGrid: false,
    alignmentHints: true,
    objectSnap: false,
    presentationMode: false,
  };
}

function makeTestShape(id: string): Shape {
  return {
    id,
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    strokeColor: '#000000',
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillColor: 'transparent',
    fillStyle: 'hachure',
    opacity: 1,
    roughness: 1,
    rotation: 0,
    textAlign: 'center',
    verticalAlign: 'middle',
  } as Shape;
}

describe('createTabSilent', () => {
  beforeEach(() => {
    // Reset to a known single-tab state
    const initialTabId = 'test_tab_init';
    tabStore.set({
      tabs: [{ id: initialTabId, title: 'Initial', isDirty: false, canvasState: null }],
      activeTabId: initialTabId,
    });
    canvasStore.set(makeDefaultCanvasState());
    historyManager.clear();
  });

  it('creates tab without switching activeTabId', () => {
    const before = get(tabStore).activeTabId;
    const newId = createTabSilent('Silent Tab');
    const after = get(tabStore);

    expect(after.activeTabId).toBe(before);
    expect(after.tabs.length).toBe(2);
    expect(after.tabs.find(t => t.id === newId)).toBeDefined();
  });

  it('new tab has non-null canvasState', () => {
    const newId = createTabSilent('Test');
    const tab = get(tabStore).tabs.find(t => t.id === newId)!;
    expect(tab.canvasState).not.toBeNull();
  });

  it('new tab has empty default state', () => {
    const newId = createTabSilent('Empty');
    const tab = get(tabStore).tabs.find(t => t.id === newId)!;
    const state = tab.canvasState!;
    expect(state.shapes.size).toBe(0);
    expect(state.shapesArray.length).toBe(0);
  });

  it('canvasStore is unaffected by createTabSilent', () => {
    const shape = makeTestShape('shape_keep');
    addShape(shape);

    createTabSilent('Another');

    const state = get(canvasStore);
    expect(state.shapes.has('shape_keep')).toBe(true);
    expect(state.shapesArray.length).toBe(1);
  });
});
