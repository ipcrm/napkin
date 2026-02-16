import { vi } from 'vitest';

// Mock Tauri APIs before any imports that use them
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('$lib/shapes/image', () => ({
  createImageFromURL: vi.fn().mockRejectedValue(new Error('not in test')),
}));

import { get } from 'svelte/store';
import { handleToolCall, getMcpActiveTabId, resetMcpState } from './handler';
import { tabStore, createTabSilent, getTabCanvasState } from '$lib/state/tabStore';
import { canvasStore, clearCanvas, type CanvasState } from '$lib/state/canvasStore';
import { historyManager } from '$lib/state/history';

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

describe('MCP handler — session isolation', () => {
  let initialTabId: string;

  beforeEach(() => {
    initialTabId = 'test_ui_tab';
    tabStore.set({
      tabs: [{ id: initialTabId, title: 'UI Tab', isDirty: false, canvasState: null }],
      activeTabId: initialTabId,
    });
    canvasStore.set(makeDefaultCanvasState());
    historyManager.clear();
    resetMcpState();
  });

  // --- MCP cursor management ---

  it('mcpActiveTabId starts as null', () => {
    expect(getMcpActiveTabId()).toBeNull();
  });

  it('create_tab sets MCP cursor to new tab', async () => {
    const result = await handleToolCall('create_tab', { title: 'MCP Tab' });
    expect(result.id).toBeDefined();
    expect(getMcpActiveTabId()).toBe(result.id);
  });

  it('create_tab does not change UI activeTabId', async () => {
    const uiBefore = get(tabStore).activeTabId;
    await handleToolCall('create_tab', { title: 'MCP Tab' });
    expect(get(tabStore).activeTabId).toBe(uiBefore);
  });

  it('switch_tab moves MCP cursor', async () => {
    const secondTabId = createTabSilent('Second');
    await handleToolCall('switch_tab', { tabId: secondTabId });
    expect(getMcpActiveTabId()).toBe(secondTabId);
  });

  it('switch_tab does not change UI activeTabId', async () => {
    const uiBefore = get(tabStore).activeTabId;
    const secondTabId = createTabSilent('Second');
    await handleToolCall('switch_tab', { tabId: secondTabId });
    expect(get(tabStore).activeTabId).toBe(uiBefore);
  });

  it('switch_tab returns error for non-existent tab', async () => {
    const result = await handleToolCall('switch_tab', { tabId: 'no_such_tab' });
    expect(result.error).toBeDefined();
  });

  // --- Shape routing ---

  it('create_shape goes to MCP cursor tab', async () => {
    const { id: mcpTabId } = await handleToolCall('create_tab', { title: 'MCP' });
    const shape = await handleToolCall('create_shape', { type: 'rectangle', x: 0, y: 0 });

    // Shape should be on the MCP tab
    const mcpState = getTabCanvasState(mcpTabId);
    expect(mcpState).not.toBeNull();
    expect(mcpState!.shapes.has(shape.id)).toBe(true);

    // Shape should NOT be on the UI tab
    const uiState = get(canvasStore);
    expect(uiState.shapes.has(shape.id)).toBe(false);
  });

  it('list_shapes reads from MCP cursor tab', async () => {
    const { id: mcpTabId } = await handleToolCall('create_tab', { title: 'MCP' });
    await handleToolCall('create_shape', { type: 'ellipse', x: 10, y: 10 });

    const result = await handleToolCall('list_shapes', {});
    expect(result.count).toBe(1);
    expect(result.shapes[0].type).toBe('ellipse');
  });

  it('get_canvas reads from MCP cursor tab', async () => {
    await handleToolCall('create_tab', { title: 'MCP' });
    await handleToolCall('create_shape', { type: 'rectangle', x: 0, y: 0 });
    await handleToolCall('create_shape', { type: 'ellipse', x: 50, y: 50 });

    const result = await handleToolCall('get_canvas', {});
    expect(result.shapeCount).toBe(2);
  });

  // --- Fallback behavior ---

  it('with null cursor, operations go to UI active tab', async () => {
    // mcpActiveTabId is null after resetMcpState()
    const shape = await handleToolCall('create_shape', { type: 'rectangle', x: 0, y: 0 });

    const uiState = get(canvasStore);
    expect(uiState.shapes.has(shape.id)).toBe(true);
  });

  // --- list_tabs enrichment ---

  it('list_tabs includes mcpActiveTabId and isMcpActive', async () => {
    const { id: mcpTabId } = await handleToolCall('create_tab', { title: 'MCP' });
    const result = await handleToolCall('list_tabs', {});

    expect(result.mcpActiveTabId).toBe(mcpTabId);

    const mcpTab = result.tabs.find((t: any) => t.id === mcpTabId);
    expect(mcpTab.isMcpActive).toBe(true);

    const uiTab = result.tabs.find((t: any) => t.id === initialTabId);
    expect(uiTab.isMcpActive).toBe(false);
  });

  // --- Edge case: deleted tab ---

  it('operations fail gracefully when MCP target tab is removed', async () => {
    const { id: mcpTabId } = await handleToolCall('create_tab', { title: 'Doomed' });

    // Remove the tab directly from the store
    tabStore.update(s => ({
      ...s,
      tabs: s.tabs.filter(t => t.id !== mcpTabId),
    }));

    const result = await handleToolCall('create_shape', { type: 'rectangle', x: 0, y: 0 });
    expect(result.error).toBeDefined();
  });
});
