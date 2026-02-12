/**
 * MCP tool request handler.
 *
 * Listens for "mcp-tool-request" Tauri events from the Rust MCP server,
 * dispatches to the appropriate handler, and sends the result back via
 * the "api_response" Tauri command.
 */

import { get } from 'svelte/store';
import { canvasStore, generateShapeId } from '$lib/state/canvasStore';
import type { Shape, Group } from '$lib/state/canvasStore';
import { historyManager, AddShapeCommand, ModifyShapeCommand, DeleteShapeCommand, DeleteShapesCommand, BatchCommand, GroupShapesCommand, UngroupShapesCommand } from '$lib/state/history';
import { tabStore, createTab, switchTab, snapshotActiveTab } from '$lib/state/tabStore';
import { getShapeConnectionPoints, getBindingPoint } from '$lib/utils/binding';
import { createImageFromURL } from '$lib/shapes/image';
import type { ShapeType, ConnectionPoint } from '$lib/types';

interface McpToolRequest {
  request_id: string;
  tool_name: string;
  arguments: any;
}

export async function initApiHandler(): Promise<void> {
  const { listen } = await import('@tauri-apps/api/event');
  const { invoke } = await import('@tauri-apps/api/core');

  listen<McpToolRequest>('mcp-tool-request', async (event) => {
    const { request_id, tool_name, arguments: args } = event.payload;
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
}

async function handleToolCall(toolName: string, args: any): Promise<any> {
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
    case 'group_shapes': return handleGroupShapes(args);
    case 'ungroup': return handleUngroup(args);
    case 'clear_canvas': return handleClearCanvas();
    case 'batch_operations': return handleBatchOperations(args);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}

// --- Helpers ---

function serializeShape(shape: Shape): any {
  return { ...shape };
}

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
  const state = get(canvasStore);
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
  const state = get(canvasStore);
  if (state.shapesArray.length > 0) {
    const cmd = new DeleteShapesCommand(state.shapesArray.map(s => s.id));
    historyManager.execute(cmd);
  }
  return { success: true };
}

function handleListShapes(args: any): any {
  const state = get(canvasStore);
  let shapes = state.shapesArray;
  if (args.type) {
    shapes = shapes.filter(s => s.type === args.type);
  }
  return { shapes: shapes.map(serializeShape), count: shapes.length };
}

function handleGetShape(args: any): any {
  const state = get(canvasStore);
  const shape = state.shapes.get(args.id);
  if (!shape) return { error: `Shape not found: ${args.id}` };
  return serializeShape(shape);
}

function handleCreateShape(args: any): any {
  if (!args.type) return { error: 'Missing required field: type' };
  const shape = buildShapeFromParams(args);
  historyManager.execute(new AddShapeCommand(shape));
  return serializeShape(shape);
}

async function handleCreateImage(args: any): Promise<any> {
  const { url, x, y, width, height } = args;
  if (!url) return { error: 'Missing required field: url (data URL or http URL)' };

  try {
    const shape = await createImageFromURL(url, x ?? 0, y ?? 0);

    // Allow explicit size override
    if (width !== undefined) shape.width = width;
    if (height !== undefined) shape.height = height;

    historyManager.execute(new AddShapeCommand(shape as unknown as Shape));
    return { id: shape.id, type: 'image', x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  } catch (e) {
    return { error: `Failed to load image: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function handleUpdateShape(args: any): any {
  const state = get(canvasStore);
  const shape = state.shapes.get(args.id);
  if (!shape) return { error: `Shape not found: ${args.id}` };

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

  historyManager.execute(new ModifyShapeCommand(args.id, updates));
  return serializeShape(get(canvasStore).shapes.get(args.id)!);
}

function handleDeleteShape(args: any): any {
  const state = get(canvasStore);
  if (!state.shapes.has(args.id)) return { error: `Shape not found: ${args.id}` };
  historyManager.execute(new DeleteShapeCommand(args.id));
  return { success: true, id: args.id };
}

function handleBatchOperations(args: any): any {
  const operations = args.operations;
  if (!Array.isArray(operations)) return { error: 'Missing required field: operations (array)' };

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
}

function handleCreateConnection(args: any): any {
  const { fromShapeId, toShapeId, connectionType, routingMode, text, strokeColor, strokeWidth } = args;
  if (!fromShapeId || !toShapeId) return { error: 'Missing required fields: fromShapeId, toShapeId' };

  const state = get(canvasStore);
  const fromShape = state.shapes.get(fromShapeId);
  const toShape = state.shapes.get(toShapeId);
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

  historyManager.execute(new AddShapeCommand(shape));
  return serializeShape(shape);
}

function handleSetViewport(args: any): any {
  const state = get(canvasStore);
  const viewport = { ...state.viewport };
  if (args.x !== undefined) viewport.x = args.x;
  if (args.y !== undefined) viewport.y = args.y;
  if (args.zoom !== undefined) viewport.zoom = Math.max(0.1, Math.min(10, args.zoom));
  canvasStore.update(s => ({ ...s, viewport }));
  return viewport;
}

function handleSetSelection(args: any): any {
  const ids: string[] = args.ids ?? [];
  canvasStore.update(s => ({ ...s, selectedIds: new Set(ids) }));
  return { selectedIds: ids };
}

function handleListTabs(): any {
  snapshotActiveTab();
  const state = get(tabStore);
  return {
    tabs: state.tabs.map(t => ({
      id: t.id, title: t.title, isDirty: t.isDirty, isActive: t.id === state.activeTabId,
    })),
    activeTabId: state.activeTabId,
  };
}

function handleCreateTab(args: any): any {
  const title = args.title ?? 'Untitled';
  return { id: createTab(title), title };
}

function handleSwitchTab(args: any): any {
  const state = get(tabStore);
  if (!state.tabs.find(t => t.id === args.tabId)) return { error: `Tab not found: ${args.tabId}` };
  switchTab(args.tabId);
  return { success: true, activeTabId: args.tabId };
}

function handleGroupShapes(args: any): any {
  const ids: string[] = args.ids;
  if (!Array.isArray(ids) || ids.length < 2) return { error: 'Need at least 2 shape IDs to group' };

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
}

function handleUngroup(args: any): any {
  const state = get(canvasStore);
  if (!state.groups.has(args.groupId)) return { error: `Group not found: ${args.groupId}` };
  historyManager.execute(new UngroupShapesCommand(args.groupId));
  return { success: true, groupId: args.groupId };
}
