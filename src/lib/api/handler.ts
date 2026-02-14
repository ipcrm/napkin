/**
 * MCP tool request handler.
 *
 * Listens for "mcp-tool-request" Tauri events from the Rust MCP server,
 * dispatches to the appropriate handler, and sends the result back via
 * the "api_response" Tauri command.
 *
 * MCP session isolation: The MCP server maintains its own "active tab" cursor
 * (mcpActiveTabId) independent of the UI. MCP create_tab/switch_tab only move
 * this cursor — they never switch the user's visible tab. All shape operations
 * route through the MCP cursor, falling back to the UI's active tab when the
 * cursor is null (no prior MCP tab operation).
 *
 * Request serialization: A promise-based queue ensures MCP tool calls execute
 * one at a time, preventing interleaving from concurrent Rust event emissions.
 */

import { get } from 'svelte/store';
import { canvasStore, generateShapeId } from '$lib/state/canvasStore';
import type { Shape, Group } from '$lib/state/canvasStore';
import { historyManager, AddShapeCommand, ModifyShapeCommand, DeleteShapeCommand, DeleteShapesCommand, BatchCommand, GroupShapesCommand, UngroupShapesCommand } from '$lib/state/history';
import { tabStore, createTabSilent, snapshotActiveTab, renameTab, getTabCanvasState, updateTabCanvasState } from '$lib/state/tabStore';
import { bringToFront, sendToBack, bringForward, sendBackward } from '$lib/state/canvasStore';
import { getShapeConnectionPoints, getBindingPoint } from '$lib/utils/binding';
import { createImageFromURL } from '$lib/shapes/image';
import type { ShapeType, ConnectionPoint } from '$lib/types';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface McpToolRequest {
  request_id: string;
  tool_name: string;
  arguments: any;
}

// --- MCP session state ---

/** MCP's independent tab cursor. null = fall back to UI's active tab. */
let mcpActiveTabId: string | null = null;

/** Promise-based request queue — ensures MCP tool calls execute one at a time. */
let mcpQueue: Promise<void> = Promise.resolve();

/** Read-only access to MCP cursor for testing. */
export function getMcpActiveTabId(): string | null {
  return mcpActiveTabId;
}

/** Reset MCP session state (for tests). */
export function resetMcpState(): void {
  mcpActiveTabId = null;
  mcpQueue = Promise.resolve();
}

export async function initApiHandler(): Promise<void> {

  listen<McpToolRequest>('mcp-tool-request', async (event) => {
    const { request_id, tool_name, arguments: args } = event.payload;

    // Chain onto the queue — ensures sequential execution
    mcpQueue = mcpQueue.then(async () => {
      try {
        const result = await handleToolCall(tool_name, args);
        await invoke('api_response', { requestId: request_id, result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await invoke('api_response', {
          requestId: request_id,
          result: { error: message },
        });
      }
    });
  });
}

export async function handleToolCall(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'get_canvas': return handleGetCanvas();
    case 'list_shapes': return handleListShapes(args);
    case 'get_shape': return handleGetShape(args);
    case 'create_shape': return handleCreateShape(args);
    case 'create_image': return handleCreateImage(args);
    case 'update_shape': return handleUpdateShape(args);
    case 'delete_shape': return handleDeleteShape(args);
    case 'create_connection': return handleCreateConnection(args);
    case 'set_viewport': return handleSetViewport(args);
    case 'select_shapes': return handleSetSelection(args);
    case 'list_tabs': return handleListTabs();
    case 'create_tab': return handleCreateTab(args);
    case 'switch_tab': return handleSwitchTab(args);
    case 'rename_tab': return handleRenameTab(args);
    case 'group_shapes': return handleGroupShapes(args);
    case 'ungroup': return handleUngroup(args);
    case 'clear_canvas': return handleClearCanvas();
    case 'batch_operations': return handleBatchOperations(args);
    case 'bring_to_front': return handleBringToFront(args);
    case 'send_to_back': return handleSendToBack(args);
    case 'bring_forward': return handleBringForward(args);
    case 'send_backward': return handleSendBackward(args);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}

// --- Tab isolation helpers ---

/**
 * Resolve which tab to operate on using the MCP cursor,
 * falling back to the UI's active tab.
 */
function resolveCanvasState(): { canvasState: CanvasState; resolvedTabId: string } | { error: string } {
  const tabState = get(tabStore);
  const resolvedTabId = mcpActiveTabId || tabState.activeTabId;

  const canvasState = getTabCanvasState(resolvedTabId);
  if (!canvasState) {
    return { error: `Tab not found: ${resolvedTabId}` };
  }
  return { canvasState, resolvedTabId };
}

/**
 * Execute a shape mutation on the correct tab (MCP cursor or UI active).
 * For the active tab, uses historyManager (supports undo).
 * For non-active tabs, modifies stored state directly (no undo).
 */
function executeOnTab(
  activeFn: () => any,
  directFn: (state: CanvasState) => { state: CanvasState; result: any }
): any {
  const tabState = get(tabStore);
  const resolvedTabId = mcpActiveTabId || tabState.activeTabId;

  if (resolvedTabId === tabState.activeTabId) {
    // Active tab — use historyManager for undo support
    return activeFn();
  }

  // Non-active tab — operate on stored state directly
  const canvasState = getTabCanvasState(resolvedTabId);
  if (!canvasState) {
    return { error: `Tab not found: ${resolvedTabId}` };
  }

  const { state: newState, result } = directFn(canvasState);
  updateTabCanvasState(resolvedTabId, newState);
  return result;
}

// --- Helpers ---

function serializeShape(shape: Shape): any {
  return { ...shape };
}

type CanvasState = import('$lib/state/canvasStore').CanvasState;

function serializeGroups(groups: Map<string, Group>): any[] {
  return Array.from(groups.values()).map(g => ({
    id: g.id,
    shapeIds: g.shapeIds,
    parentGroupId: g.parentGroupId,
  }));
}

function buildShapeFromParams(params: any): Shape {
  const id = generateShapeId();
  const type: ShapeType = params.type;

  const base = {
    id,
    type,
    x: params.x ?? 0,
    y: params.y ?? 0,
    strokeColor: params.strokeColor ?? '#000000',
    strokeWidth: params.strokeWidth ?? 2,
    strokeStyle: params.strokeStyle ?? 'solid',
    fillColor: params.fillColor ?? 'transparent',
    fillStyle: params.fillStyle ?? 'hachure',
    opacity: params.opacity ?? 1,
    roughness: params.roughness ?? 1,
    rotation: params.rotation ?? 0,
    text: params.text,
    textAlign: params.textAlign ?? 'center',
    verticalAlign: params.verticalAlign ?? 'middle',
  };

  switch (type) {
    case 'rectangle':
    case 'ellipse':
    case 'triangle':
    case 'diamond':
    case 'hexagon':
    case 'star':
    case 'cloud':
    case 'cylinder':
      return { ...base, width: params.width ?? 200, height: params.height ?? 150 } as Shape;

    case 'sticky':
      return {
        ...base,
        width: params.width ?? 200,
        height: params.height ?? 200,
        stickyColor: params.stickyColor ?? '#fff9c4',
        fontSize: params.fontSize ?? 16,
        text: params.text ?? '',
        fillColor: params.stickyColor ?? '#fff9c4',
      } as Shape;

    case 'text':
      return {
        ...base,
        text: params.text ?? 'Text',
        fontSize: params.fontSize ?? 20,
        fontFamily: params.fontFamily ?? 'sans-serif',
        width: params.width ?? 200,
        height: params.height ?? 30,
        strokeWidth: 0,
        fillColor: 'transparent',
      } as Shape;

    case 'line':
      return {
        ...base,
        x2: params.x2 ?? (params.x ?? 0) + (params.width ?? 200),
        y2: params.y2 ?? params.y ?? 0,
        routingMode: params.routingMode ?? 'direct',
      } as Shape;

    case 'arrow':
      return {
        ...base,
        x2: params.x2 ?? (params.x ?? 0) + (params.width ?? 200),
        y2: params.y2 ?? params.y ?? 0,
        arrowheadStart: false,
        arrowheadEnd: true,
        routingMode: params.routingMode ?? 'direct',
        startEndpoint: params.startEndpoint ?? { shape: 'none', size: 1 },
        endEndpoint: params.endEndpoint ?? { shape: 'arrow', size: 1 },
      } as Shape;

    default:
      return { ...base, width: params.width ?? 200, height: params.height ?? 150 } as Shape;
  }
}

// --- Tool handlers ---

function handleGetCanvas(): any {
  const resolved = resolveCanvasState();
  if ('error' in resolved) return resolved;
  const state = resolved.canvasState;
  return {
    shapes: state.shapesArray.map(serializeShape),
    viewport: state.viewport,
    groups: serializeGroups(state.groups),
    activeTool: state.activeTool,
    showGrid: state.showGrid,
    shapeCount: state.shapesArray.length,
  };
}

function handleClearCanvas(): any {
  return executeOnTab(
    () => {
      const state = get(canvasStore);
      if (state.shapesArray.length > 0) {
        historyManager.execute(new DeleteShapesCommand(state.shapesArray.map(s => s.id)));
      }
      return { success: true };
    },
    (state) => ({
      state: { ...state, shapes: new Map(), shapesArray: [], selectedIds: new Set() },
      result: { success: true },
    })
  );
}

function handleListShapes(args: any): any {
  const resolved = resolveCanvasState();
  if ('error' in resolved) return resolved;
  const state = resolved.canvasState;
  let shapes = state.shapesArray;
  if (args?.type) {
    shapes = shapes.filter(s => s.type === args.type);
  }
  return { shapes: shapes.map(serializeShape), count: shapes.length };
}

function handleGetShape(args: any): any {
  const resolved = resolveCanvasState();
  if ('error' in resolved) return resolved;
  const state = resolved.canvasState;
  const shape = state.shapes.get(args.id);
  if (!shape) return { error: `Shape not found: ${args.id}` };
  return serializeShape(shape);
}

function handleCreateShape(args: any): any {
  if (!args.type) return { error: 'Missing required field: type' };
  const shape = buildShapeFromParams(args);
  return executeOnTab(
    () => {
      historyManager.execute(new AddShapeCommand(shape));
      return serializeShape(shape);
    },
    (state) => {
      const newShapes = new Map(state.shapes);
      newShapes.set(shape.id, shape);
      return {
        state: { ...state, shapes: newShapes, shapesArray: [...state.shapesArray, shape] },
        result: serializeShape(shape),
      };
    }
  );
}

async function handleCreateImage(args: any): Promise<any> {
  const { url, x, y, width, height } = args;
  if (!url) return { error: 'Missing required field: url (data URL or http URL)' };

  try {
    const shape = await createImageFromURL(url, x ?? 0, y ?? 0);

    // Allow explicit size override
    if (width !== undefined) shape.width = width;
    if (height !== undefined) shape.height = height;

    return executeOnTab(
      () => {
        historyManager.execute(new AddShapeCommand(shape as unknown as Shape));
        return { id: shape.id, type: 'image', x: shape.x, y: shape.y, width: shape.width, height: shape.height };
      },
      (state) => {
        const s = shape as unknown as Shape;
        const newShapes = new Map(state.shapes);
        newShapes.set(s.id, s);
        return {
          state: { ...state, shapes: newShapes, shapesArray: [...state.shapesArray, s] },
          result: { id: shape.id, type: 'image', x: shape.x, y: shape.y, width: shape.width, height: shape.height },
        };
      }
    );
  } catch (e) {
    return { error: `Failed to load image: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function handleUpdateShape(args: any): any {
  const updates: Partial<Shape> = {};
  const allowed = [
    'x', 'y', 'width', 'height', 'x2', 'y2',
    'strokeColor', 'strokeWidth', 'strokeStyle',
    'fillColor', 'fillStyle', 'opacity', 'roughness',
    'rotation', 'text', 'textAlign', 'verticalAlign',
    'fontSize', 'fontFamily', 'stickyColor',
    'routingMode', 'labelPosition',
  ];
  for (const key of allowed) {
    if (args[key] !== undefined) (updates as any)[key] = args[key];
  }

  return executeOnTab(
    () => {
      const state = get(canvasStore);
      if (!state.shapes.has(args.id)) return { error: `Shape not found: ${args.id}` };
      historyManager.execute(new ModifyShapeCommand(args.id, updates));
      return serializeShape(get(canvasStore).shapes.get(args.id)!);
    },
    (state) => {
      const shape = state.shapes.get(args.id);
      if (!shape) return { state, result: { error: `Shape not found: ${args.id}` } };
      const updatedShape = { ...shape, ...updates, id: args.id } as Shape;
      const newShapes = new Map(state.shapes);
      newShapes.set(args.id, updatedShape);
      return {
        state: { ...state, shapes: newShapes, shapesArray: state.shapesArray.map(s => s.id === args.id ? updatedShape : s) } as CanvasState,
        result: serializeShape(updatedShape),
      };
    }
  );
}

function handleDeleteShape(args: any): any {
  return executeOnTab(
    () => {
      if (!get(canvasStore).shapes.has(args.id)) return { error: `Shape not found: ${args.id}` };
      historyManager.execute(new DeleteShapeCommand(args.id));
      return { success: true, id: args.id };
    },
    (state) => {
      if (!state.shapes.has(args.id)) return { state, result: { error: `Shape not found: ${args.id}` } };
      const newShapes = new Map(state.shapes);
      newShapes.delete(args.id);
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(args.id);
      return {
        state: { ...state, shapes: newShapes, shapesArray: state.shapesArray.filter(s => s.id !== args.id), selectedIds: newSelectedIds },
        result: { success: true, id: args.id },
      };
    }
  );
}

function handleBatchOperations(args: any): any {
  const operations = args.operations;
  if (!Array.isArray(operations)) return { error: 'Missing required field: operations (array)' };

  return executeOnTab(
    () => {
      // Active tab — use historyManager
      const commands: any[] = [];
      const results: any[] = [];

      for (const op of operations) {
        const { action, data } = op;
        switch (action) {
          case 'create': {
            if (!data.type) { results.push({ error: 'Missing type for create' }); continue; }
            const shape = buildShapeFromParams(data);
            commands.push(new AddShapeCommand(shape));
            results.push({ action: 'created', shape: serializeShape(shape) });
            break;
          }
          case 'update': {
            if (!data.id) { results.push({ error: 'Missing id for update' }); continue; }
            if (!get(canvasStore).shapes.has(data.id)) { results.push({ error: `Shape not found: ${data.id}` }); continue; }
            const { id: _id, ...rest } = data;
            commands.push(new ModifyShapeCommand(data.id, rest));
            results.push({ action: 'updated', id: data.id });
            break;
          }
          case 'delete': {
            if (!data.id) { results.push({ error: 'Missing id for delete' }); continue; }
            if (!get(canvasStore).shapes.has(data.id)) { results.push({ error: `Shape not found: ${data.id}` }); continue; }
            commands.push(new DeleteShapeCommand(data.id));
            results.push({ action: 'deleted', id: data.id });
            break;
          }
          default:
            results.push({ error: `Unknown action: ${action}` });
        }
      }

      if (commands.length > 0) historyManager.execute(new BatchCommand(commands));
      return { results };
    },
    (canvasState) => {
      // Non-active tab — modify state directly
      let state = canvasState;
      const results: any[] = [];

      for (const op of operations) {
        const { action, data } = op;
        switch (action) {
          case 'create': {
            if (!data.type) { results.push({ error: 'Missing type for create' }); continue; }
            const shape = buildShapeFromParams(data);
            const newShapes = new Map(state.shapes);
            newShapes.set(shape.id, shape);
            state = { ...state, shapes: newShapes, shapesArray: [...state.shapesArray, shape] };
            results.push({ action: 'created', shape: serializeShape(shape) });
            break;
          }
          case 'update': {
            if (!data.id) { results.push({ error: 'Missing id for update' }); continue; }
            const existing = state.shapes.get(data.id);
            if (!existing) { results.push({ error: `Shape not found: ${data.id}` }); continue; }
            const { id: _id, ...rest } = data;
            const updated = { ...existing, ...rest, id: data.id };
            const updShapes = new Map(state.shapes);
            updShapes.set(data.id, updated);
            state = { ...state, shapes: updShapes, shapesArray: state.shapesArray.map(s => s.id === data.id ? updated : s) };
            results.push({ action: 'updated', id: data.id });
            break;
          }
          case 'delete': {
            if (!data.id) { results.push({ error: 'Missing id for delete' }); continue; }
            if (!state.shapes.has(data.id)) { results.push({ error: `Shape not found: ${data.id}` }); continue; }
            const delShapes = new Map(state.shapes);
            delShapes.delete(data.id);
            state = { ...state, shapes: delShapes, shapesArray: state.shapesArray.filter(s => s.id !== data.id) };
            results.push({ action: 'deleted', id: data.id });
            break;
          }
          default:
            results.push({ error: `Unknown action: ${action}` });
        }
      }

      return { state, result: { results } };
    }
  );
}

function handleCreateConnection(args: any): any {
  const { fromShapeId, toShapeId, connectionType, routingMode, text, strokeColor, strokeWidth } = args;
  if (!fromShapeId || !toShapeId) return { error: 'Missing required fields: fromShapeId, toShapeId' };

  const resolved = resolveCanvasState();
  if ('error' in resolved) return resolved;
  const resolvedState = resolved.canvasState;

  const fromShape = resolvedState.shapes.get(fromShapeId);
  const toShape = resolvedState.shapes.get(toShapeId);
  if (!fromShape) return { error: `Source shape not found: ${fromShapeId}` };
  if (!toShape) return { error: `Target shape not found: ${toShapeId}` };

  const fromPoint = getBindingPoint(fromShape, 'center', { x: toShape.x + ((toShape as any).width || 0) / 2, y: toShape.y + ((toShape as any).height || 0) / 2 });
  const toPoint = getBindingPoint(toShape, 'center', { x: fromShape.x + ((fromShape as any).width || 0) / 2, y: fromShape.y + ((fromShape as any).height || 0) / 2 });

  const type = connectionType === 'line' ? 'line' : 'arrow';
  const id = generateShapeId();

  const shapeBase = {
    id,
    type: type as ShapeType,
    x: fromPoint.x, y: fromPoint.y,
    x2: toPoint.x, y2: toPoint.y,
    strokeColor: strokeColor ?? '#000000',
    strokeWidth: strokeWidth ?? 2,
    strokeStyle: 'solid' as const,
    fillColor: 'transparent',
    opacity: 1, roughness: 1, rotation: 0,
    routingMode: routingMode ?? 'direct',
    bindStart: { shapeId: fromShapeId, point: 'center' as ConnectionPoint },
    bindEnd: { shapeId: toShapeId, point: 'center' as ConnectionPoint },
    text,
  };

  const shape: Shape = type === 'arrow'
    ? { ...shapeBase, arrowheadStart: false, arrowheadEnd: true, startEndpoint: { shape: 'none', size: 1 }, endEndpoint: { shape: 'arrow', size: 1 } } as unknown as Shape
    : shapeBase as unknown as Shape;

  return executeOnTab(
    () => {
      historyManager.execute(new AddShapeCommand(shape));
      return serializeShape(shape);
    },
    (state) => {
      const newShapes = new Map(state.shapes);
      newShapes.set(shape.id, shape);
      return {
        state: { ...state, shapes: newShapes, shapesArray: [...state.shapesArray, shape] },
        result: serializeShape(shape),
      };
    }
  );
}

function handleSetViewport(args: any): any {
  return executeOnTab(
    () => {
      const state = get(canvasStore);
      const viewport = { ...state.viewport };
      if (args.x !== undefined) viewport.x = args.x;
      if (args.y !== undefined) viewport.y = args.y;
      if (args.zoom !== undefined) viewport.zoom = Math.max(0.1, Math.min(10, args.zoom));
      canvasStore.update(s => ({ ...s, viewport }));
      return viewport;
    },
    (state) => {
      const viewport = { ...state.viewport };
      if (args.x !== undefined) viewport.x = args.x;
      if (args.y !== undefined) viewport.y = args.y;
      if (args.zoom !== undefined) viewport.zoom = Math.max(0.1, Math.min(10, args.zoom));
      return { state: { ...state, viewport }, result: viewport };
    }
  );
}

function handleSetSelection(args: any): any {
  const ids: string[] = args.ids ?? [];
  return executeOnTab(
    () => {
      canvasStore.update(s => ({ ...s, selectedIds: new Set(ids) }));
      return { selectedIds: ids };
    },
    (state) => ({
      state: { ...state, selectedIds: new Set(ids) },
      result: { selectedIds: ids },
    })
  );
}

function handleListTabs(): any {
  snapshotActiveTab();
  const state = get(tabStore);
  return {
    tabs: state.tabs.map(t => ({
      id: t.id,
      title: t.title,
      isDirty: t.isDirty,
      isActive: t.id === state.activeTabId,
      isMcpActive: mcpActiveTabId ? t.id === mcpActiveTabId : t.id === state.activeTabId,
    })),
    activeTabId: state.activeTabId,
    mcpActiveTabId: mcpActiveTabId,
  };
}

function handleCreateTab(args: any): any {
  const title = args?.title ?? 'Untitled';
  const newId = createTabSilent(title);
  mcpActiveTabId = newId;
  return { id: newId, title };
}

function handleSwitchTab(args: any): any {
  const state = get(tabStore);
  if (!state.tabs.find(t => t.id === args.tabId)) return { error: `Tab not found: ${args.tabId}` };
  mcpActiveTabId = args.tabId;
  return { success: true, mcpActiveTabId: args.tabId };
}

function handleRenameTab(args: any): any {
  if (!args.tabId) return { error: 'Missing required field: tabId' };
  if (!args.title) return { error: 'Missing required field: title' };
  const state = get(tabStore);
  if (!state.tabs.find(t => t.id === args.tabId)) return { error: `Tab not found: ${args.tabId}` };
  renameTab(args.tabId, args.title);
  return { success: true, tabId: args.tabId, title: args.title };
}

// --- Z-index handlers ---

function handleBringToFront(args: any): any {
  if (!args.id) return { error: 'Missing required field: id' };
  return executeOnTab(
    () => {
      if (!get(canvasStore).shapes.has(args.id)) return { error: `Shape not found: ${args.id}` };
      bringToFront(args.id);
      return { success: true, id: args.id };
    },
    (state) => {
      const shape = state.shapes.get(args.id);
      if (!shape) return { state, result: { error: `Shape not found: ${args.id}` } };
      return {
        state: { ...state, shapesArray: [...state.shapesArray.filter(s => s.id !== args.id), shape] },
        result: { success: true, id: args.id },
      };
    }
  );
}

function handleSendToBack(args: any): any {
  if (!args.id) return { error: 'Missing required field: id' };
  return executeOnTab(
    () => {
      if (!get(canvasStore).shapes.has(args.id)) return { error: `Shape not found: ${args.id}` };
      sendToBack(args.id);
      return { success: true, id: args.id };
    },
    (state) => {
      const shape = state.shapes.get(args.id);
      if (!shape) return { state, result: { error: `Shape not found: ${args.id}` } };
      return {
        state: { ...state, shapesArray: [shape, ...state.shapesArray.filter(s => s.id !== args.id)] },
        result: { success: true, id: args.id },
      };
    }
  );
}

function handleBringForward(args: any): any {
  if (!args.id) return { error: 'Missing required field: id' };
  return executeOnTab(
    () => {
      if (!get(canvasStore).shapes.has(args.id)) return { error: `Shape not found: ${args.id}` };
      bringForward(args.id);
      return { success: true, id: args.id };
    },
    (state) => {
      const shape = state.shapes.get(args.id);
      if (!shape) return { state, result: { error: `Shape not found: ${args.id}` } };
      const idx = state.shapesArray.findIndex(s => s.id === args.id);
      if (idx === -1 || idx === state.shapesArray.length - 1) return { state, result: { success: true, id: args.id } };
      const newArray = [...state.shapesArray];
      [newArray[idx], newArray[idx + 1]] = [newArray[idx + 1], newArray[idx]];
      return { state: { ...state, shapesArray: newArray }, result: { success: true, id: args.id } };
    }
  );
}

function handleSendBackward(args: any): any {
  if (!args.id) return { error: 'Missing required field: id' };
  return executeOnTab(
    () => {
      if (!get(canvasStore).shapes.has(args.id)) return { error: `Shape not found: ${args.id}` };
      sendBackward(args.id);
      return { success: true, id: args.id };
    },
    (state) => {
      const shape = state.shapes.get(args.id);
      if (!shape) return { state, result: { error: `Shape not found: ${args.id}` } };
      const idx = state.shapesArray.findIndex(s => s.id === args.id);
      if (idx <= 0) return { state, result: { success: true, id: args.id } };
      const newArray = [...state.shapesArray];
      [newArray[idx], newArray[idx - 1]] = [newArray[idx - 1], newArray[idx]];
      return { state: { ...state, shapesArray: newArray }, result: { success: true, id: args.id } };
    }
  );
}

function handleGroupShapes(args: any): any {
  const ids: string[] = args.ids;
  if (!Array.isArray(ids) || ids.length < 2) return { error: 'Need at least 2 shape IDs to group' };

  return executeOnTab(
    () => {
      const state = get(canvasStore);
      for (const id of ids) {
        if (!state.shapes.has(id)) return { error: `Shape not found: ${id}` };
      }
      historyManager.execute(new GroupShapesCommand(ids));
      const newState = get(canvasStore);
      const group = Array.from(newState.groups.values()).find(g =>
        g.shapeIds.length === ids.length && ids.every(id => g.shapeIds.includes(id))
      );
      return { groupId: group?.id, shapeIds: ids };
    },
    (state) => {
      for (const id of ids) {
        if (!state.shapes.has(id)) return { state, result: { error: `Shape not found: ${id}` } };
      }
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newShapes = new Map(state.shapes);
      ids.forEach(id => {
        const shape = newShapes.get(id);
        if (shape) newShapes.set(id, { ...shape, groupId });
      });
      const newGroups = new Map(state.groups);
      newGroups.set(groupId, { id: groupId, shapeIds: [...ids] });
      const newShapesArray = state.shapesArray.map(s => newShapes.get(s.id) || s);
      return {
        state: { ...state, shapes: newShapes, shapesArray: newShapesArray, groups: newGroups },
        result: { groupId, shapeIds: ids },
      };
    }
  );
}

function handleUngroup(args: any): any {
  return executeOnTab(
    () => {
      if (!get(canvasStore).groups.has(args.groupId)) return { error: `Group not found: ${args.groupId}` };
      historyManager.execute(new UngroupShapesCommand(args.groupId));
      return { success: true, groupId: args.groupId };
    },
    (state) => {
      const group = state.groups.get(args.groupId);
      if (!group) return { state, result: { error: `Group not found: ${args.groupId}` } };
      const newShapes = new Map(state.shapes);
      group.shapeIds.forEach(id => {
        const shape = newShapes.get(id);
        if (shape) {
          const { groupId: _, ...rest } = shape;
          newShapes.set(id, rest as Shape);
        }
      });
      const newGroups = new Map(state.groups);
      newGroups.delete(args.groupId);
      const newShapesArray = state.shapesArray.map(s => newShapes.get(s.id) || s);
      return {
        state: { ...state, shapes: newShapes, shapesArray: newShapesArray, groups: newGroups },
        result: { success: true, groupId: args.groupId },
      };
    }
  );
}
