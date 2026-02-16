<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { canvasStore, type ToolType, type Shape, toggleGrid, enterPresentationMode, exitPresentationMode, updateShapes } from '$lib/state/canvasStore';
  import { tabStore, switchTab } from '$lib/state/tabStore';
  import { SelectTool } from '$lib/tools/selectTool';
  import { RectangleTool } from '$lib/tools/rectangleTool';
  import { EllipseTool } from '$lib/tools/ellipseTool';
  import { TriangleTool } from '$lib/tools/triangleTool';
  import { DiamondTool } from '$lib/tools/diamondTool';
  import { HexagonTool } from '$lib/tools/hexagonTool';
  import { StarTool } from '$lib/tools/starTool';
  import { CloudTool } from '$lib/tools/cloudTool';
  import { CylinderTool } from '$lib/tools/cylinderTool';
  import { LineTool } from '$lib/tools/lineTool';
  import { ArrowTool } from '$lib/tools/arrowTool';
  import { FreedrawTool } from '$lib/tools/freedrawTool';
  import { TextTool } from '$lib/tools/textTool';
  import { PanTool } from '$lib/tools/panTool';
  import { StickyNoteTool } from '$lib/tools/stickyNoteTool';
  import type { Tool, ToolContext } from '$lib/tools/toolBase';
  import type { PointerEventData, KeyboardEventData } from '$lib/types';
  import { historyManager, AddShapeCommand, ModifyShapeCommand, DeleteShapeCommand, DeleteShapesCommand, BatchCommand, GroupShapesCommand, UngroupShapesCommand } from '$lib/state/history';
  import { generateShapeId } from '$lib/state/canvasStore';
  import ContextMenu from './ContextMenu.svelte';
  import HelpDialog from './HelpDialog.svelte';
  import {
    drawRoughRectangle,
    drawRoughEllipse,
    drawRoughLine,
    drawRoughArrow,
    drawRoughPath,
    drawRoughTriangle,
    drawRoughDiamond,
    drawRoughHexagon,
    drawRoughStar,
    drawRoughCloud,
    drawRoughCylinder,
    resetRoughCanvas,
    type TextGap
  } from '$lib/canvas/roughRenderer';
  import { handleImagePaste, handleImageDrop, renderImage, ensureImageLoaded } from '$lib/shapes/image';
  import { findShapeAtPoint } from '$lib/canvas/hitDetection';
  import { applyStrokeStyle } from '$lib/canvas/strokeStyles';
  import { traceCloudPath } from '$lib/shapes/cloud';
  import { getElbowPathPoints, getEndAngle, getStartAngle, getDefaultControlPoints } from '$lib/utils/routing';
  import { drawEndpointShape, getEffectiveEndpoint } from '$lib/canvas/endpointRenderer';
  import MultiSelectToolbar from './MultiSelectToolbar.svelte';

  let canvasElement: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let currentTool: Tool | null = null;
  let animationFrameId: number | null = null;
  let isDirty = true;
  let isSpacebarHeld = false;
  let previousTool: ToolType | null = null;

  // Meta/Cmd+drag panning state
  let isMetaPanning = false;
  let metaPanStartX = 0;
  let metaPanStartY = 0;
  let metaPanStartViewportX = 0;
  let metaPanStartViewportY = 0;
  let metaPanCurrentZoom = 1;
  let isMetaKeyHeld = false;

  // Presentation mode click-to-highlight state
  let presentationClickStart: { x: number; y: number } | null = null;

  // Context menu state
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuComponent: ContextMenu;

  // Help dialog state
  let helpDialogVisible = false;
  let helpDialogComponent: HelpDialog;

  // Text editing state
  let editingShapeId: string | null = null;
  let editingText = '';
  let textPosition = { x: 0, y: 0 };
  let textSize = { width: 0, height: 0 };
  let textFontSize = 14;
  let textFontFamily = 'sans-serif';
  let textAlign: 'center' | 'left' = 'center';
  let textVerticalAlign: 'top' | 'middle' | 'bottom' = 'middle';
  let textPaddingTop = 0; // Computed padding to match verticalAlign positioning
  let editingShapeType: string = '';
  let finishingTextEdit = false; // Re-entry guard for finishTextEditing

  // Selection aura animation state
  interface AuraEffect {
    shapeId: string;
    startTime: number;
    bounds: { x: number; y: number; width: number; height: number };
  }
  let activeAuras: AuraEffect[] = [];
  const AURA_DURATION = 400; // ms
  let previousSelectedIds = new Set<string>();

  function sameIdSet(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const id of a) {
      if (!b.has(id)) return false;
    }
    return true;
  }

  // Multi-selection toolbar state
  let multiSelectToolbarX = 0;
  let multiSelectToolbarY = 0;
  let multiSelectShapes: any[] = [];
  let showMultiSelectToolbar = false;
  // When true, keep toolbar visible even if selection is a single group
  // (set after user clicks Group in the toolbar, cleared on next selection change)
  let toolbarGroupedKeepVisible = false;
  let previousToolbarSelIds: Set<string> = new Set();

  /**
   * Check if all selected shapes belong to exactly one group
   */
  function isSelectionSingleGroup(selIds: Set<string>, shapesArray: any[]): boolean {
    if (selIds.size < 2) return false;
    let groupId: string | null = null;
    for (const shape of shapesArray) {
      if (selIds.has(shape.id)) {
        if (!shape.groupId) return false;
        if (groupId === null) {
          groupId = shape.groupId;
        } else if (shape.groupId !== groupId) {
          return false;
        }
      }
    }
    return groupId !== null;
  }

  function resetSelectToolDrag(): void {
    const st = tools.select as any;
    st.isDragging = false;
    st.isResizing = false;
    st.isRotating = false;
    st.isBoxSelecting = false;
    st.isDuplicating = false;
    st.isDraggingControlPoint = false;
    st.isDraggingEndpoint = false;
    st.isConnecting = false;
    st.connectCurrentArrow = null;
    st.connectStartPoint = null;
    st.connectStartShapeId = null;
    st.connectEndPoint = null;
    st.currentHandle = null;
    st.resizeStartBounds = null;
    st.selectedShapeStartPositions?.clear?.();
  }

  function handleToolbarGroup(): void {
    const unlocked = multiSelectShapes.filter(s => !s.locked).map(s => s.id);
    if (unlocked.length >= 2) {
      resetSelectToolDrag();
      toolbarGroupedKeepVisible = true;
      historyManager.execute(new GroupShapesCommand(unlocked));
    }
  }

  function handleToolbarUngroup(): void {
    const groupIds = new Set<string>();
    for (const s of multiSelectShapes) {
      if (s.groupId) groupIds.add(s.groupId);
    }
    if (groupIds.size > 0) {
      resetSelectToolDrag();
      const commands = Array.from(groupIds).map(gid => new UngroupShapesCommand(gid));
      historyManager.execute(new BatchCommand(commands));
    }
  }

  // Reactively compute multi-select toolbar position and visibility
  // We subscribe to the store and recompute when selection or viewport changes
  $: {
    const state = $canvasStore;
    const selIds = state.selectedIds;

    // If the set of selected shape IDs changed, clear the keep-visible flag
    if (!sameIdSet(selIds, previousToolbarSelIds)) {
      toolbarGroupedKeepVisible = false;
      previousToolbarSelIds = new Set(selIds);
    }

    const isSingleGroup = isSelectionSingleGroup(selIds, state.shapesArray);
    const shouldShow = selIds.size >= 2 && state.activeTool === 'select' && (!isSingleGroup || toolbarGroupedKeepVisible);
    if (shouldShow) {
      const selected: any[] = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const shape of state.shapesArray) {
        if (selIds.has(shape.id)) {
          selected.push(shape);
          const sx = shape.x;
          const sy = shape.y;
          const sw = (shape as any).width || ((shape as any).x2 != null ? Math.abs((shape as any).x2 - shape.x) : 0);
          const sh = (shape as any).height || ((shape as any).y2 != null ? Math.abs((shape as any).y2 - shape.y) : 0);
          const s: any = shape;
          const ex = shape.type === 'line' || shape.type === 'arrow'
            ? Math.min(shape.x, s.x2 ?? shape.x)
            : sx;
          const ey = shape.type === 'line' || shape.type === 'arrow'
            ? Math.min(shape.y, s.y2 ?? shape.y)
            : sy;
          const ew = shape.type === 'line' || shape.type === 'arrow'
            ? Math.abs((s.x2 ?? shape.x) - shape.x)
            : sw;
          const eh = shape.type === 'line' || shape.type === 'arrow'
            ? Math.abs((s.y2 ?? shape.y) - shape.y)
            : sh;
          minX = Math.min(minX, ex);
          minY = Math.min(minY, ey);
          maxX = Math.max(maxX, ex + ew);
          maxY = Math.max(maxY, ey + eh);
        }
      }
      if (minX !== Infinity) {
        const vp = state.viewport;
        // Convert canvas center-top of selection to screen coords
        const centerCanvasX = (minX + maxX) / 2;
        const screenCX = centerCanvasX * vp.zoom + vp.x;
        const screenTopY = minY * vp.zoom + vp.y;
        const screenBottomY = maxY * vp.zoom + vp.y;
        // Clamp X to keep toolbar within viewport (toolbar is ~500px wide, centered)
        const clampedX = Math.max(250, Math.min(window.innerWidth - 250, screenCX));
        // Prefer above selection; if too close to top, place below
        let clampedY = screenTopY - 50;
        if (clampedY < 8) {
          clampedY = screenBottomY + 15;
        }
        clampedY = Math.min(clampedY, window.innerHeight - 50);
        clampedY = Math.max(8, clampedY);
        multiSelectToolbarX = clampedX;
        multiSelectToolbarY = clampedY;
        multiSelectShapes = selected;
        showMultiSelectToolbar = true;
      } else {
        showMultiSelectToolbar = false;
        multiSelectShapes = [];
      }
    } else {
      showMultiSelectToolbar = false;
      multiSelectShapes = [];
    }
  }

  // Export help dialog visibility setter
  export function showHelpDialog() {
    helpDialogVisible = true;
  }

  // Tool instances (created once and reused)
  const tools = {
    select: new SelectTool(),
    rectangle: new RectangleTool(),
    ellipse: new EllipseTool(),
    triangle: new TriangleTool(),
    diamond: new DiamondTool(),
    hexagon: new HexagonTool(),
    star: new StarTool(),
    cloud: new CloudTool(),
    cylinder: new CylinderTool(),
    line: new LineTool(),
    arrow: new ArrowTool(),
    freedraw: new FreedrawTool(),
    text: new TextTool(),
    sticky: new StickyNoteTool(),
    pan: new PanTool(),
  };

  // Subscribe to canvas store
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Get canvas context
    ctx = canvasElement.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context');
      return;
    }

    // Setup high DPI rendering
    setupHighDPI();

    // Set canvas element for text tool
    if (tools.text && 'setCanvasElement' in tools.text) {
      (tools.text as any).setCanvasElement(canvasElement);
    }

    // Set text edit callback for select tool
    if (tools.select && 'setTextEditCallback' in tools.select) {
      (tools.select as any).setTextEditCallback(startTextEditing);
    }

    // Subscribe to canvas store changes
    unsubscribe = canvasStore.subscribe((state) => {
      // Switch active tool if needed
      if (state.activeTool !== currentTool?.constructor.name.replace('Tool', '').toLowerCase()) {
        switchTool(state.activeTool);
      }

      // Update tool style presets
      if (currentTool && 'setStylePreset' in currentTool) {
        (currentTool as any).setStylePreset(state.stylePreset);
      }

      // Mark as dirty to trigger redraw
      markDirty();
    });

    // Start rendering loop
    startRenderLoop();

    // Handle container resize (covers window resize AND layout changes like presentation mode)
    const parent = canvasElement.parentElement;
    let resizeObserver: ResizeObserver | null = null;
    if (parent) {
      resizeObserver = new ResizeObserver(() => {
        if (!canvasElement) return;
        const p = canvasElement.parentElement;
        if (p) {
          resizeCanvas(p.clientWidth, p.clientHeight);
        }
      });
      resizeObserver.observe(parent);
      resizeCanvas(parent.clientWidth, parent.clientHeight); // Initial size
    }

    // Handle paste for images
    const onPaste = async (event: ClipboardEvent) => {
      // Skip if editing text
      if (editingShapeId) return;

      // Check if clipboard has image
      const items = event.clipboardData?.items;
      if (!items) return;

      let hasImage = false;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          hasImage = true;
          break;
        }
      }

      if (!hasImage) {
        // No image in clipboard - handle shape paste from internal clipboard
        event.preventDefault();
        handlePaste();
        return;
      }

      event.preventDefault();

      // Calculate viewport center
      const state = $canvasStore;
      const canvasRect = canvasElement.getBoundingClientRect();
      const centerX = (canvasRect.width / 2 - state.viewport.x) / state.viewport.zoom;
      const centerY = (canvasRect.height / 2 - state.viewport.y) / state.viewport.zoom;

      const imageShape = await handleImagePaste(event, centerX, centerY);
      if (imageShape) {
        historyManager.execute(new AddShapeCommand(imageShape));
        canvasStore.update(s => ({
          ...s,
          selectedIds: new Set([imageShape.id]),
        }));
        markDirty();
      }
    };

    window.addEventListener('paste', onPaste);

    // Listen for native menu events dispatched from App.svelte
    const onNapkinUndo = () => handleUndo();
    const onNapkinRedo = () => handleRedo();
    const onNapkinCopy = () => handleCopy();
    const onNapkinCut = () => {
      handleCopy();
      // Trigger delete via the keyboard handler which routes to selectTool
      handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }));
    };
    const onNapkinPasteShapes = () => handlePaste();

    window.addEventListener('napkin-undo', onNapkinUndo);
    window.addEventListener('napkin-redo', onNapkinRedo);
    window.addEventListener('napkin-copy', onNapkinCopy);
    window.addEventListener('napkin-cut', onNapkinCut);
    window.addEventListener('napkin-paste-shapes', onNapkinPasteShapes);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('napkin-undo', onNapkinUndo);
      window.removeEventListener('napkin-redo', onNapkinRedo);
      window.removeEventListener('napkin-copy', onNapkinCopy);
      window.removeEventListener('napkin-cut', onNapkinCut);
      window.removeEventListener('napkin-paste-shapes', onNapkinPasteShapes);
    };
  });

  onDestroy(() => {
    stopRenderLoop();
    if (unsubscribe) {
      unsubscribe();
    }
  });

  /**
   * Setup high DPI rendering
   */
  function setupHighDPI() {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasElement.getBoundingClientRect();

    canvasElement.width = rect.width * dpr;
    canvasElement.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    canvasElement.style.width = `${rect.width}px`;
    canvasElement.style.height = `${rect.height}px`;
  }

  /**
   * Resize canvas
   */
  function resizeCanvas(width: number, height: number) {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    canvasElement.width = width * dpr;
    canvasElement.height = height * dpr;
    ctx.scale(dpr, dpr);

    canvasElement.style.width = `${width}px`;
    canvasElement.style.height = `${height}px`;

    markDirty();
  }

  /**
   * Mark canvas as dirty
   */
  function markDirty() {
    isDirty = true;
  }

  /**
   * Start rendering loop
   */
  function startRenderLoop() {
    const renderFrame = () => {
      if (isDirty) {
        render();
        isDirty = false;
      }
      animationFrameId = requestAnimationFrame(renderFrame);
    };
    renderFrame();
  }

  /**
   * Stop rendering loop
   */
  function stopRenderLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * Draw a grid background on the canvas
   */
  function drawGrid(
    ctx: CanvasRenderingContext2D,
    viewport: { x: number; y: number; zoom: number },
    screenWidth: number,
    screenHeight: number
  ) {
    const gridSpacing = 20; // Grid spacing in canvas units
    const { x: vpX, y: vpY, zoom } = viewport;

    // Calculate the pixel spacing on screen
    const pixelSpacing = gridSpacing * zoom;

    // Don't draw grid if spacing is too small (would be too dense)
    if (pixelSpacing < 6) return;

    ctx.save();

    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;

    // Calculate the first grid line positions in screen space
    const firstGridX = Math.floor(vpX / gridSpacing) * gridSpacing;
    const firstGridY = Math.floor(vpY / gridSpacing) * gridSpacing;
    const firstScreenX = (firstGridX - vpX) * zoom;
    const firstScreenY = (firstGridY - vpY) * zoom;

    // Draw vertical lines
    ctx.beginPath();
    for (let sx = firstScreenX; sx <= screenWidth; sx += pixelSpacing) {
      const snapped = Math.round(sx) + 0.5;
      ctx.moveTo(snapped, 0);
      ctx.lineTo(snapped, screenHeight);
    }
    ctx.stroke();

    // Draw horizontal lines
    ctx.beginPath();
    for (let sy = firstScreenY; sy <= screenHeight; sy += pixelSpacing) {
      const snapped = Math.round(sy) + 0.5;
      ctx.moveTo(0, snapped);
      ctx.lineTo(screenWidth, snapped);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Get shape bounds for aura effect
   */
  function getShapeBoundsForAura(shape: any): { x: number; y: number; width: number; height: number } {
    if (shape.type === 'line' || shape.type === 'arrow') {
      return {
        x: Math.min(shape.x, shape.x2),
        y: Math.min(shape.y, shape.y2),
        width: Math.abs(shape.x2 - shape.x) || 4,
        height: Math.abs(shape.y2 - shape.y) || 4,
      };
    }
    if (shape.type === 'freedraw' && shape.points?.length > 0) {
      const xs = shape.points.map((p: any) => p.x);
      const ys = shape.points.map((p: any) => p.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs) || 4,
        height: Math.max(...ys) - Math.min(...ys) || 4,
      };
    }
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width || 4,
      height: shape.height || 4,
    };
  }

  /**
   * Render canvas
   */
  function render() {
    if (!ctx) return;

    const state = $canvasStore;
    const { width, height } = canvasElement.getBoundingClientRect();

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw grid background if enabled
    if (state.showGrid) {
      drawGrid(ctx, state.viewport, width, height);
    }

    // Apply viewport transformation
    ctx.save();
    const { x, y, zoom } = state.viewport;
    ctx.translate(-x * zoom, -y * zoom);
    ctx.scale(zoom, zoom);

    // Detect newly selected shapes for aura effect (only in presentation mode)
    const currentSelectedIds = state.selectedIds;
    const now = performance.now();
    if (state.presentationMode) {
      for (const id of currentSelectedIds) {
        if (!previousSelectedIds.has(id)) {
          const shape = state.shapes.get(id);
          if (shape) {
            const bounds = getShapeBoundsForAura(shape);
            activeAuras.push({ shapeId: id, startTime: now, bounds });
          }
        }
      }
    }
    previousSelectedIds = new Set(currentSelectedIds);

    // Clean up expired auras
    activeAuras = activeAuras.filter(a => now - a.startTime < AURA_DURATION);

    // Render shapes
    for (const shape of state.shapesArray) {
      renderShape(ctx, shape);
    }

    // Render aura effects
    if (activeAuras.length > 0) {
      for (const aura of activeAuras) {
        const elapsed = now - aura.startTime;
        const progress = elapsed / AURA_DURATION;
        const alpha = 0.4 * (1 - progress);
        const expand = 8 + 12 * progress;
        const b = aura.bounds;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 2 * (1 - progress * 0.5);
        ctx.shadowColor = '#1a73e8';
        ctx.shadowBlur = 8 + 8 * progress;

        // Draw expanding rounded rect
        const rx = b.x - expand;
        const ry = b.y - expand;
        const rw = b.width + expand * 2;
        const rh = b.height + expand * 2;
        const radius = 6 + expand * 0.5;
        ctx.beginPath();
        ctx.moveTo(rx + radius, ry);
        ctx.lineTo(rx + rw - radius, ry);
        ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
        ctx.lineTo(rx + rw, ry + rh - radius);
        ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
        ctx.lineTo(rx + radius, ry + rh);
        ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
        ctx.lineTo(rx, ry + radius);
        ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      // Keep rendering while auras are active
      markDirty();
    }

    // Render tool overlay (skip in presentation mode)
    if (currentTool && !state.presentationMode) {
      const toolContext = createToolContext();
      currentTool.renderOverlay(ctx, toolContext);
    }

    ctx.restore();
  }

  /**
   * Render a single shape
   */
  function renderShape(ctx: CanvasRenderingContext2D, shape: any) {
    ctx.save();
    ctx.globalAlpha = shape.opacity || 1;

    // Apply rotation if present
    if (shape.rotation && shape.rotation !== 0) {
      const centerX = shape.x + (shape.width || 0) / 2;
      const centerY = shape.y + (shape.height || 0) / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(shape.rotation);
      ctx.translate(-centerX, -centerY);
    }

    // Check if shape is selected
    const isSelected = $canvasStore.selectedIds.has(shape.id);

    // If this shape is being text-edited, render a version without text
    // so the textarea overlay text doesn't double up with the canvas text
    const isBeingEdited = shape.id === editingShapeId;
    const shapeForRender = isBeingEdited ? { ...shape, text: '' } : shape;

    switch (shape.type) {
      case 'rectangle':
        renderRectangle(ctx, shapeForRender, isSelected);
        break;
      case 'ellipse':
        renderEllipse(ctx, shapeForRender, isSelected);
        break;
      case 'triangle':
        renderTriangle(ctx, shapeForRender, isSelected);
        break;
      case 'diamond':
        renderDiamond(ctx, shapeForRender, isSelected);
        break;
      case 'hexagon':
        renderHexagon(ctx, shapeForRender, isSelected);
        break;
      case 'star':
        renderStar(ctx, shapeForRender, isSelected);
        break;
      case 'cloud':
        renderCloud(ctx, shapeForRender, isSelected);
        break;
      case 'cylinder':
        renderCylinder(ctx, shapeForRender, isSelected);
        break;
      case 'line':
        renderLine(ctx, shapeForRender, isSelected);
        break;
      case 'arrow':
        renderArrow(ctx, shapeForRender, isSelected);
        break;
      case 'freedraw':
        renderFreedrawShape(ctx, shapeForRender, isSelected);
        break;
      case 'text':
        renderTextShape(ctx, shapeForRender, isSelected);
        break;
      case 'sticky':
        renderStickyNoteShape(ctx, shapeForRender, isSelected);
        break;
      case 'image': {
        if (!shapeForRender.loaded && shapeForRender.src) {
          ensureImageLoaded(shapeForRender).then(() => markDirty());
        }
        renderImage(ctx, shapeForRender);
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Render sticky note shape
   */
  function renderStickyNoteShape(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const { x, y, stickyColor, fontSize, strokeWidth } = shape;
    const width = shape.width || 150;
    const height = shape.height || 150;
    const cornerRadius = 4;
    const foldSize = Math.min(16, width * 0.12, height * 0.12);
    const bgColor = stickyColor || '#fff9c4';

    // Draw shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    // Draw main body path
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - foldSize, y);
    ctx.lineTo(x + width, y + foldSize);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.closePath();

    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.restore(); // Remove shadow

    // Draw border
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - foldSize, y);
    ctx.lineTo(x + width, y + foldSize);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.closePath();

    ctx.strokeStyle = darkenHexColor(bgColor, 0.15);
    ctx.lineWidth = strokeWidth || 1;
    ctx.stroke();

    // Draw fold corner
    ctx.beginPath();
    ctx.moveTo(x + width - foldSize, y);
    ctx.lineTo(x + width - foldSize, y + foldSize);
    ctx.lineTo(x + width, y + foldSize);
    ctx.closePath();

    ctx.fillStyle = darkenHexColor(bgColor, 0.08);
    ctx.fill();
    ctx.strokeStyle = darkenHexColor(bgColor, 0.15);
    ctx.lineWidth = strokeWidth || 1;
    ctx.stroke();

    // Render text if present
    if (shape.text) {
      renderStickyNoteText(ctx, shape, width, height);
    }
  }

  /**
   * Render text wrapped inside a sticky note
   */
  function renderStickyNoteText(ctx: CanvasRenderingContext2D, shape: any, width: number, height: number) {
    const padding = 10;
    const maxWidth = width - padding * 2;
    const fSize = shape.fontSize || 14;
    const lineHeight = fSize * 1.3;
    const hAlign = shape.textAlign || 'center';
    const vAlign = shape.verticalAlign || 'middle';

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = shape.strokeColor || '#333333';
    ctx.font = `${fSize}px sans-serif`;
    ctx.textBaseline = 'top';

    // Set horizontal alignment
    let textAnchorAlign: CanvasTextAlign = 'left';
    if (hAlign === 'center') textAnchorAlign = 'center';
    else if (hAlign === 'right') textAnchorAlign = 'right';
    ctx.textAlign = textAnchorAlign;

    // Calculate x anchor
    let anchorX: number;
    if (hAlign === 'center') {
      anchorX = shape.x + width / 2;
    } else if (hAlign === 'right') {
      anchorX = shape.x + width - padding;
    } else {
      anchorX = shape.x + padding;
    }

    // Word wrap
    const lines: string[] = [];
    const paragraphs = (shape.text || '').split('\n');
    for (const paragraph of paragraphs) {
      if (paragraph === '') { lines.push(''); continue; }
      const words = paragraph.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }

    // Vertical positioning
    const totalTextHeight = lines.length * lineHeight;
    const availableHeight = height - padding * 2;
    let startY: number;
    if (vAlign === 'top') {
      startY = shape.y + padding;
    } else if (vAlign === 'bottom') {
      startY = shape.y + height - padding - totalTextHeight;
    } else {
      // middle
      if (totalTextHeight < availableHeight) {
        startY = shape.y + (height - totalTextHeight) / 2;
      } else {
        startY = shape.y + padding;
      }
    }

    // Clip to shape bounds
    ctx.beginPath();
    ctx.rect(shape.x + padding, shape.y + padding, maxWidth, height - padding * 2);
    ctx.clip();

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], anchorX, startY + i * lineHeight);
    }
    ctx.restore();
  }

  /**
   * Darken a hex color by a given factor (0-1)
   */
  function darkenHexColor(hex: string, factor: number): string {
    if (!hex || hex.length < 7) return '#999999';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.round(r * (1 - factor));
    const dg = Math.round(g * (1 - factor));
    const db = Math.round(b * (1 - factor));
    return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  }

  /**
   * Render text label on a shape
   */
  function renderShapeText(ctx: CanvasRenderingContext2D, shape: any, width: number, height: number) {
    if (!shape.text) return;

    ctx.save();
    ctx.globalAlpha = 1;

    // Use shape's font properties or defaults
    const fontSize = shape.fontSize || 14;
    const fontFamily = shape.fontFamily || 'sans-serif';
    const hAlign = shape.textAlign || 'center';
    const vAlign = shape.verticalAlign || 'middle';
    const padding = 10;
    const labelPosition = shape.labelPosition || 'inside';
    const gap = 4; // gap between shape edge and outside text

    ctx.fillStyle = shape.strokeColor || '#000';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    // Simple word wrap
    const maxWidth = labelPosition === 'inside' ? width - padding * 2 : width;
    const paragraphs = (shape.text || '').split('\n');
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph === '') { lines.push(''); continue; }
      const words = paragraph.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }

    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;

    let anchorX: number;
    let startY: number;

    if (labelPosition === 'outside-top') {
      ctx.textAlign = 'center';
      anchorX = shape.x + width / 2;
      startY = shape.y - gap - totalHeight + lineHeight / 2;
    } else if (labelPosition === 'outside-bottom') {
      ctx.textAlign = 'center';
      anchorX = shape.x + width / 2;
      startY = shape.y + height + gap + lineHeight / 2;
    } else if (labelPosition === 'outside-left') {
      ctx.textAlign = 'right';
      anchorX = shape.x - gap;
      startY = shape.y + height / 2 - totalHeight / 2 + lineHeight / 2;
    } else if (labelPosition === 'outside-right') {
      ctx.textAlign = 'left';
      anchorX = shape.x + width + gap;
      startY = shape.y + height / 2 - totalHeight / 2 + lineHeight / 2;
    } else {
      // 'inside' — original behavior
      let textAnchorAlign: CanvasTextAlign = 'center';
      if (hAlign === 'left') textAnchorAlign = 'left';
      else if (hAlign === 'right') textAnchorAlign = 'right';
      ctx.textAlign = textAnchorAlign;

      if (hAlign === 'left') {
        anchorX = shape.x + padding;
      } else if (hAlign === 'right') {
        anchorX = shape.x + width - padding;
      } else {
        anchorX = shape.x + width / 2;
      }

      if (vAlign === 'top') {
        startY = shape.y + padding + lineHeight / 2;
      } else if (vAlign === 'bottom') {
        startY = shape.y + height - padding - totalHeight + lineHeight / 2;
      } else {
        startY = shape.y + height / 2 - totalHeight / 2 + lineHeight / 2;
      }
    }

    for (const line of lines) {
      ctx.fillText(line, anchorX, startY);
      startY += lineHeight;
    }

    ctx.restore();
  }

  /**
   * Calculate the text gap for a line/arrow when it has a text label.
   * Returns the gap coordinates where the line should be interrupted,
   * or null if the line is too short for a gap.
   */
  function calculateTextGap(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    text: string,
    fontSize: number = 14,
    fontFamily: string = 'sans-serif'
  ): { gap: TextGap; textWidth: number; textHeight: number; midX: number; midY: number } | null {
    if (!text) return null;

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;

    // Measure text dimensions
    const lines = text.split('\n');
    let maxLineWidth = 0;
    for (const line of lines) {
      const metrics = ctx.measureText(line);
      maxLineWidth = Math.max(maxLineWidth, metrics.width);
    }
    const textWidth = maxLineWidth;
    const lineHeight = fontSize * 1.2;
    const textHeight = lines.length * lineHeight;

    ctx.restore();

    // Padding around text for the gap
    const paddingX = 8;
    const paddingY = 4;
    const totalGapWidth = textWidth + paddingX * 2;
    const totalGapHeight = textHeight + paddingY * 2;

    // Calculate line length
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    // If line is too short for the gap, don't create one
    if (lineLength < totalGapWidth + 20) return null;

    // Calculate midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Calculate unit vector along the line
    const ux = dx / lineLength;
    const uy = dy / lineLength;

    // Calculate the half-gap distance along the line direction
    // We need to account for the angle: the gap in the line direction
    // should be large enough to clear the text bounding box
    // For a rotated rectangle, the projection along the line is:
    // halfGap = (textWidth/2 * |cos(0)| + textHeight/2 * |sin(0)|) + padding
    // But since text is always axis-aligned, we need the projection of the
    // text bounding box onto the line direction
    const angle = Math.atan2(dy, dx);
    const cosA = Math.abs(Math.cos(angle));
    const sinA = Math.abs(Math.sin(angle));
    const halfGapAlongLine = (totalGapWidth / 2) * cosA + (totalGapHeight / 2) * sinA;

    // Gap start and end points along the line
    const gapStartX = midX - ux * halfGapAlongLine;
    const gapStartY = midY - uy * halfGapAlongLine;
    const gapEndX = midX + ux * halfGapAlongLine;
    const gapEndY = midY + uy * halfGapAlongLine;

    return {
      gap: { gapStartX, gapStartY, gapEndX, gapEndY },
      textWidth,
      textHeight,
      midX,
      midY
    };
  }

  /**
   * Render text label on a line or arrow shape, centered at the midpoint.
   * Draws a semi-transparent background behind the text for legibility.
   */
  function renderLineText(
    ctx: CanvasRenderingContext2D,
    shape: any,
    midX: number,
    midY: number,
    textWidth: number,
    textHeight: number
  ) {
    if (!shape.text) return;

    ctx.save();
    ctx.globalAlpha = 1;

    const fontSize = shape.fontSize || 14;
    const fontFamily = shape.fontFamily || 'sans-serif';
    const paddingX = 8;
    const paddingY = 4;

    // Draw a background rectangle behind the text for extra legibility
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(
      midX - textWidth / 2 - paddingX,
      midY - textHeight / 2 - paddingY,
      textWidth + paddingX * 2,
      textHeight + paddingY * 2
    );

    // Draw the text
    ctx.fillStyle = shape.strokeColor || '#000';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = shape.text.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    let startY = midY - totalHeight / 2 + lineHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, midX, startY);
      startY += lineHeight;
    }

    ctx.restore();
  }

  /**
   * Render rectangle shape
   */
  function renderRectangle(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    // Use Rough.js for sketchy rendering
    if (roughness > 0 && canvasElement) {
      drawRoughRectangle(
        ctx,
        canvasElement,
        shape.x,
        shape.y,
        shape.width || 0,
        shape.height || 0,
        {
          strokeColor: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          strokeStyle: shape.strokeStyle,
          fillColor: shape.fillColor,
          fillStyle: shape.fillStyle,
          roughness: roughness,
        }
      );
    } else {
      // Perfect shapes (roughness = 0)
      // Draw fill
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.fillRect(shape.x, shape.y, shape.width || 0, shape.height || 0);
      }

      // Draw stroke
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        ctx.strokeRect(shape.x, shape.y, shape.width || 0, shape.height || 0);
        ctx.setLineDash([]);
      }
    }

    // Render text label if present
    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render ellipse shape
   */
  function renderEllipse(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    // Use Rough.js for sketchy rendering
    if (roughness > 0 && canvasElement) {
      drawRoughEllipse(
        ctx,
        canvasElement,
        shape.x,
        shape.y,
        shape.width || 0,
        shape.height || 0,
        {
          strokeColor: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          strokeStyle: shape.strokeStyle,
          fillColor: shape.fillColor,
          fillStyle: shape.fillStyle,
          roughness: roughness,
        }
      );
    } else {
      // Perfect shapes (roughness = 0)
      const cx = shape.x + (shape.width || 0) / 2;
      const cy = shape.y + (shape.height || 0) / 2;
      const rx = Math.abs(shape.width || 0) / 2;
      const ry = Math.abs(shape.height || 0) / 2;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);

      // Draw fill
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.fill();
      }

      // Draw stroke
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Render text label if present
    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render triangle shape
   */
  function renderTriangle(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0 && canvasElement) {
      drawRoughTriangle(ctx, canvasElement, shape.x, shape.y, shape.width || 0, shape.height || 0, {
        strokeColor: shape.strokeColor,
        strokeWidth: shape.strokeWidth,
        strokeStyle: shape.strokeStyle,
        fillColor: shape.fillColor,
        fillStyle: shape.fillStyle,
        roughness: roughness,
      });
    } else {
      const w = shape.width || 0;
      const h = shape.height || 0;
      ctx.beginPath();
      ctx.moveTo(shape.x + w / 2, shape.y);
      ctx.lineTo(shape.x, shape.y + h);
      ctx.lineTo(shape.x + w, shape.y + h);
      ctx.closePath();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.fill();
      }
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render diamond shape
   */
  function renderDiamond(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0 && canvasElement) {
      drawRoughDiamond(ctx, canvasElement, shape.x, shape.y, shape.width || 0, shape.height || 0, {
        strokeColor: shape.strokeColor,
        strokeWidth: shape.strokeWidth,
        strokeStyle: shape.strokeStyle,
        fillColor: shape.fillColor,
        fillStyle: shape.fillStyle,
        roughness: roughness,
      });
    } else {
      const w = shape.width || 0;
      const h = shape.height || 0;
      const cx = shape.x + w / 2;
      const cy = shape.y + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, shape.y);
      ctx.lineTo(shape.x + w, cy);
      ctx.lineTo(cx, shape.y + h);
      ctx.lineTo(shape.x, cy);
      ctx.closePath();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.fill();
      }
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render hexagon shape
   */
  function renderHexagon(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0 && canvasElement) {
      drawRoughHexagon(ctx, canvasElement, shape.x, shape.y, shape.width || 0, shape.height || 0, {
        strokeColor: shape.strokeColor,
        strokeWidth: shape.strokeWidth,
        strokeStyle: shape.strokeStyle,
        fillColor: shape.fillColor,
        fillStyle: shape.fillStyle,
        roughness: roughness,
      });
    } else {
      const w = shape.width || 0;
      const h = shape.height || 0;
      const cx = shape.x + w / 2;
      const cy = shape.y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.fill();
      }
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render star shape
   */
  function renderStar(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0 && canvasElement) {
      drawRoughStar(ctx, canvasElement, shape.x, shape.y, shape.width || 0, shape.height || 0, {
        strokeColor: shape.strokeColor,
        strokeWidth: shape.strokeWidth,
        strokeStyle: shape.strokeStyle,
        fillColor: shape.fillColor,
        fillStyle: shape.fillStyle,
        roughness: roughness,
      });
    } else {
      const w = shape.width || 0;
      const h = shape.height || 0;
      const cx = shape.x + w / 2;
      const cy = shape.y + h / 2;
      const outerRadius = Math.min(w, h) / 2;
      const innerRadius = outerRadius * 0.4;
      const points = 5;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const px = cx + radius * Math.cos(angle) * (w / h);
        const py = cy + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.fill();
      }
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render cloud shape
   */
  function renderCloud(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0 && canvasElement) {
      drawRoughCloud(ctx, canvasElement, shape.x, shape.y, shape.width || 0, shape.height || 0, {
        strokeColor: shape.strokeColor,
        strokeWidth: shape.strokeWidth,
        strokeStyle: shape.strokeStyle,
        fillColor: shape.fillColor,
        fillStyle: shape.fillStyle,
        roughness: roughness,
      });
    } else {
      const w = shape.width || 0;
      const h = shape.height || 0;
      traceCloudPath(ctx, shape.x, shape.y, w, h);
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.fill();
      }
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render cylinder shape
   */
  function renderCylinder(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const roughness = shape.roughness ?? 1;

    if (roughness > 0 && canvasElement) {
      drawRoughCylinder(ctx, canvasElement, shape.x, shape.y, shape.width || 0, shape.height || 0, {
        strokeColor: shape.strokeColor,
        strokeWidth: shape.strokeWidth,
        strokeStyle: shape.strokeStyle,
        fillColor: shape.fillColor,
        fillStyle: shape.fillStyle,
        roughness: roughness,
      });
    } else {
      const w = shape.width || 0;
      const h = shape.height || 0;
      const ellipseH = h * 0.15;
      // Fill body
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor;
        ctx.beginPath();
        ctx.ellipse(shape.x + w / 2, shape.y + ellipseH / 2, w / 2, ellipseH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(shape.x, shape.y + ellipseH / 2, w, h - ellipseH);
        ctx.beginPath();
        ctx.ellipse(shape.x + w / 2, shape.y + h - ellipseH / 2, w / 2, ellipseH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (shape.strokeColor && shape.strokeWidth > 0) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        applyStrokeStyle(ctx, shape.strokeStyle);
        // Top ellipse
        ctx.beginPath();
        ctx.ellipse(shape.x + w / 2, shape.y + ellipseH / 2, w / 2, ellipseH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Side lines
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y + ellipseH / 2);
        ctx.lineTo(shape.x, shape.y + h - ellipseH / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(shape.x + w, shape.y + ellipseH / 2);
        ctx.lineTo(shape.x + w, shape.y + h - ellipseH / 2);
        ctx.stroke();
        // Bottom ellipse (only bottom half visible)
        ctx.beginPath();
        ctx.ellipse(shape.x + w / 2, shape.y + h - ellipseH / 2, w / 2, ellipseH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (shape.text) {
      renderShapeText(ctx, shape, shape.width || 0, shape.height || 0);
    }
  }

  /**
   * Render line shape
   */
  function renderLine(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const x1 = shape.x;
    const y1 = shape.y;
    const x2 = shape.x2 || shape.x;
    const y2 = shape.y2 || shape.y;
    const routingMode = shape.routingMode || 'direct';
    const controlPoints = shape.controlPoints;

    // Calculate text gap if text is present (only for direct mode)
    let gapInfo: ReturnType<typeof calculateTextGap> = null;
    if (shape.text && routingMode === 'direct') {
      gapInfo = calculateTextGap(ctx, x1, y1, x2, y2, shape.text, shape.fontSize || 14, shape.fontFamily || 'sans-serif');
    }

    if (shape.strokeColor && shape.strokeWidth > 0) {
      const roughness = shape.roughness ?? 1;

      // Use Rough.js for sketchy rendering
      if (roughness > 0 && canvasElement) {
        drawRoughLine(
          ctx,
          canvasElement,
          x1, y1, x2, y2,
          {
            strokeColor: shape.strokeColor,
            strokeWidth: shape.strokeWidth,
            strokeStyle: shape.strokeStyle,
            roughness: roughness,
            routingMode: routingMode,
            controlPoints: controlPoints,
            startEndpoint: shape.startEndpoint,
            endEndpoint: shape.endEndpoint,
          },
          gapInfo?.gap
        );
      } else {
        // Perfect shapes (roughness = 0)
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        applyStrokeStyle(ctx, shape.strokeStyle);

        if (routingMode === 'elbow') {
          const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        } else if (routingMode === 'curved') {
          const cp = controlPoints && controlPoints.length > 0
            ? controlPoints[0]
            : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(cp.x, cp.y, x2, y2);
          ctx.stroke();
        } else if (gapInfo) {
          // Direct mode with text gap
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(gapInfo.gap.gapStartX, gapInfo.gap.gapStartY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(gapInfo.gap.gapEndX, gapInfo.gap.gapEndY);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else {
          // Direct mode, no gap
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Draw endpoint shapes for lines (both rough and smooth)
      const lineEndAngle = getEndAngle(x1, y1, x2, y2, routingMode, controlPoints);
      const lineStartAngle = getStartAngle(x1, y1, x2, y2, routingMode, controlPoints);

      const lineEndEp = getEffectiveEndpoint(shape.endEndpoint, false, true);
      const lineStartEp = getEffectiveEndpoint(shape.startEndpoint, false, false);

      if (lineEndEp.shape !== 'none') {
        drawEndpointShape(ctx, x2, y2, lineEndAngle, lineEndEp.shape, lineEndEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
      }

      if (lineStartEp.shape !== 'none') {
        drawEndpointShape(ctx, x1, y1, lineStartAngle + Math.PI, lineStartEp.shape, lineStartEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
      }
    }

    // Render text label if present
    if (shape.text) {
      if (gapInfo) {
        renderLineText(ctx, shape, gapInfo.midX, gapInfo.midY, gapInfo.textWidth, gapInfo.textHeight);
      } else {
        // Fallback: line was too short for gap, render text at midpoint with background
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        ctx.save();
        const fontSize = shape.fontSize || 14;
        ctx.font = `${fontSize}px ${shape.fontFamily || 'sans-serif'}`;
        const metrics = ctx.measureText(shape.text);
        ctx.restore();
        renderLineText(ctx, shape, midX, midY, metrics.width, fontSize * 1.2);
      }
    }
  }

  /**
   * Render arrow shape
   */
  function renderArrow(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    const x1 = shape.x;
    const y1 = shape.y;
    const x2 = shape.x2 || shape.x;
    const y2 = shape.y2 || shape.y;
    const routingMode = shape.routingMode || 'direct';
    const controlPoints = shape.controlPoints;

    // Calculate text gap if text is present (only for direct mode)
    let gapInfo: ReturnType<typeof calculateTextGap> = null;
    if (shape.text && routingMode === 'direct') {
      gapInfo = calculateTextGap(ctx, x1, y1, x2, y2, shape.text, shape.fontSize || 14, shape.fontFamily || 'sans-serif');
    }

    if (shape.strokeColor && shape.strokeWidth > 0) {
      const roughness = shape.roughness ?? 1;

      // Use Rough.js for sketchy rendering
      if (roughness > 0 && canvasElement) {
        drawRoughArrow(
          ctx,
          canvasElement,
          x1, y1, x2, y2,
          {
            strokeColor: shape.strokeColor,
            strokeWidth: shape.strokeWidth,
            strokeStyle: shape.strokeStyle,
            roughness: roughness,
            arrowheadStart: shape.arrowheadStart,
            arrowheadEnd: shape.arrowheadEnd,
            routingMode: routingMode,
            controlPoints: controlPoints,
            startEndpoint: shape.startEndpoint,
            endEndpoint: shape.endEndpoint,
          },
          gapInfo?.gap
        );
      } else {
        // Perfect shapes (roughness = 0)
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        applyStrokeStyle(ctx, shape.strokeStyle);

        // Draw line based on routing mode
        if (routingMode === 'elbow') {
          const pts = getElbowPathPoints(x1, y1, x2, y2, controlPoints);
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        } else if (routingMode === 'curved') {
          const cp = controlPoints && controlPoints.length > 0
            ? controlPoints[0]
            : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(cp.x, cp.y, x2, y2);
          ctx.stroke();
        } else if (gapInfo) {
          // Direct mode with text gap
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(gapInfo.gap.gapStartX, gapInfo.gap.gapStartY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(gapInfo.gap.gapEndX, gapInfo.gap.gapEndY);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else {
          // Direct mode, no gap
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Draw endpoint shapes using routing-aware angles
        const endAngle = getEndAngle(x1, y1, x2, y2, routingMode, controlPoints);
        const startAngle = getStartAngle(x1, y1, x2, y2, routingMode, controlPoints);

        const endEp = getEffectiveEndpoint(shape.endEndpoint, shape.arrowheadEnd, true);
        const startEp = getEffectiveEndpoint(shape.startEndpoint, shape.arrowheadStart, false);

        if (endEp.shape !== 'none') {
          drawEndpointShape(ctx, x2, y2, endAngle, endEp.shape, endEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
        }

        if (startEp.shape !== 'none') {
          drawEndpointShape(ctx, x1, y1, startAngle + Math.PI, startEp.shape, startEp.size, shape.strokeWidth, shape.strokeColor, shape.strokeColor);
        }
      }
    }

    // Render text label if present
    if (shape.text) {
      if (gapInfo) {
        renderLineText(ctx, shape, gapInfo.midX, gapInfo.midY, gapInfo.textWidth, gapInfo.textHeight);
      } else {
        // Fallback: line was too short for gap, render text at midpoint with background
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        ctx.save();
        const fontSize = shape.fontSize || 14;
        ctx.font = `${fontSize}px ${shape.fontFamily || 'sans-serif'}`;
        const metrics = ctx.measureText(shape.text);
        ctx.restore();
        renderLineText(ctx, shape, midX, midY, metrics.width, fontSize * 1.2);
      }
    }
  }

  /**
   * Render freedraw shape
   */
  function renderFreedrawShape(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    if (!shape.points || shape.points.length < 2) return;

    if (shape.strokeColor && shape.strokeWidth > 0) {
      const roughness = shape.roughness ?? 1;

      // Use Rough.js for sketchy rendering
      if (roughness > 0 && canvasElement) {
        drawRoughPath(
          ctx,
          canvasElement,
          shape.points,
          {
            strokeColor: shape.strokeColor,
            strokeWidth: shape.strokeWidth,
            strokeStyle: shape.strokeStyle,
            roughness: roughness,
          }
        );
      } else {
        // Perfect shapes (roughness = 0)
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        applyStrokeStyle(ctx, shape.strokeStyle);

        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);

        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }

        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /**
   * Render text shape
   */
  function renderTextShape(ctx: CanvasRenderingContext2D, shape: any, isSelected: boolean) {
    if (!shape.text) return;

    ctx.save();
    ctx.globalAlpha = 1;

    ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
    ctx.textBaseline = 'top';

    const lines = shape.text.split('\n');

    // Draw background if fill is set
    if (shape.fillColor && shape.fillColor !== 'transparent') {
      ctx.fillStyle = shape.fillColor;
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    }

    // Draw text
    if (shape.strokeColor) {
      ctx.fillStyle = shape.strokeColor;

      for (let i = 0; i < lines.length; i++) {
        const y = shape.y + i * shape.fontSize * 1.2;
        ctx.fillText(lines[i], shape.x, y);
      }
    }

    ctx.restore();
  }

  /**
   * Switch to a different tool
   */
  function switchTool(toolType: ToolType) {
    // Finish any text editing before switching tools
    if (editingShapeId) {
      finishTextEditing();
    }

    // Deactivate current tool
    if (currentTool) {
      currentTool.onDeactivate();
    }

    // Map tool type to tool instance
    const toolKey = toolType as keyof typeof tools;
    if (toolKey in tools) {
      currentTool = tools[toolKey];
      currentTool.onActivate();

      // Update cursor
      if (canvasElement) {
        canvasElement.style.cursor = currentTool.getCursor();
      }
    }
  }

  /**
   * Create tool context from current store state
   */
  function createToolContext(): ToolContext {
    const state = $canvasStore;

    return {
      shapes: state.shapesArray as any,
      selectedIds: state.selectedIds,
      addShape: (shape) => {
        // Use history manager to track shape addition
        historyManager.execute(new AddShapeCommand(shape));
      },
      updateShape: (id, updates) => {
        // Use history manager to track shape modification
        try {
          historyManager.execute(new ModifyShapeCommand(id, updates));
        } catch (error) {
          // If shape not found, just update directly without history
          console.warn('Shape not found for history:', error);
          canvasStore.update(s => {
            const shape = s.shapes.get(id);
            if (!shape) return s;

            const updatedShape = { ...shape, ...updates, id } as Shape;
            const newShapes = new Map(s.shapes);
            newShapes.set(id, updatedShape);

            return {
              ...s,
              shapes: newShapes,
              shapesArray: s.shapesArray.map(sh => sh.id === id ? updatedShape : sh),
            };
          });
        }
      },
      updateShapeDirect: (id, updates) => {
        // Update store WITHOUT creating a history entry (for mid-drag continuous updates)
        canvasStore.update(s => {
          const shape = s.shapes.get(id);
          if (!shape) return s;
          const updatedShape = { ...shape, ...updates, id } as Shape;
          const newShapes = new Map(s.shapes);
          newShapes.set(id, updatedShape);
          return {
            ...s,
            shapes: newShapes,
            shapesArray: s.shapesArray.map(sh => sh.id === id ? updatedShape : sh),
          };
        });
      },
      deleteShape: (id) => {
        // Use history manager to track shape deletion
        try {
          historyManager.execute(new DeleteShapeCommand(id));
        } catch (error) {
          console.warn('Shape not found for deletion:', error);
        }
      },
      setSelectedIds: (ids) => {
        canvasStore.update(s => ({
          ...s,
          selectedIds: new Set(ids),
        }));
      },
      setActiveTool: (tool) => {
        canvasStore.update(s => ({
          ...s,
          activeTool: tool as any,
        }));
      },
      requestRender: () => {
        markDirty();
      },
      getViewport: () => {
        const state = $canvasStore;
        return {
          x: state.viewport.x,
          y: state.viewport.y,
          zoom: state.viewport.zoom
        };
      },
      canvasWidth: canvasElement ? canvasElement.getBoundingClientRect().width : 0,
      canvasHeight: canvasElement ? canvasElement.getBoundingClientRect().height : 0,
      snapSettings: {
        snapToGrid: state.snapToGrid,
        alignmentHints: state.alignmentHints,
        objectSnap: state.objectSnap,
        gridSize: 20,
      },
    };
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const state = $canvasStore;
    const rect = canvasElement.getBoundingClientRect();
    const { x, y, zoom } = state.viewport;

    const canvasX = (screenX - rect.left) / zoom + x;
    const canvasY = (screenY - rect.top) / zoom + y;

    return { x: canvasX, y: canvasY };
  }

  /**
   * Convert DOM pointer event to PointerEventData
   */
  function convertPointerEvent(event: PointerEvent): PointerEventData {
    const rect = canvasElement.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const { x: canvasX, y: canvasY } = screenToCanvas(event.clientX, event.clientY);

    return {
      x: event.clientX,
      y: event.clientY,
      canvasX,
      canvasY,
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
    };
  }

  /**
   * Convert DOM keyboard event to KeyboardEventData
   */
  function convertKeyboardEvent(event: KeyboardEvent): KeyboardEventData {
    return {
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
    };
  }

  /**
   * Handle pointer down event
   */
  /**
   * Check if the meta/cmd key (Mac) or ctrl key (Windows/Linux) is pressed
   * for panning purposes. We exclude ctrlKey on Mac since Ctrl+click = right-click on Mac.
   */
  function isMetaPanKey(event: PointerEvent | MouseEvent): boolean {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return isMac ? event.metaKey : event.ctrlKey;
  }

  function handlePointerDown(event: PointerEvent) {
    // Finish text editing if clicking on canvas
    if (editingShapeId) {
      finishTextEditing();
      // Don't return - allow click to continue processing
    }

    // Presentation mode: track click start for highlight-on-click, allow pan tool
    if ($canvasStore.presentationMode) {
      presentationClickStart = { x: event.clientX, y: event.clientY };
      if (!isMetaPanKey(event) && $canvasStore.activeTool !== 'pan' && $canvasStore.activeTool !== 'select') {
        return;
      }
    }

    // Check for Cmd+click (Mac) or Ctrl+click (Windows) for panning
    if (isMetaPanKey(event) && event.button === 0) {
      event.preventDefault();
      isMetaPanning = true;
      metaPanStartX = event.clientX;
      metaPanStartY = event.clientY;

      // Capture current viewport state
      const state = $canvasStore;
      metaPanStartViewportX = state.viewport.x;
      metaPanStartViewportY = state.viewport.y;
      metaPanCurrentZoom = state.viewport.zoom;

      canvasElement.style.cursor = 'grabbing';
      canvasElement.setPointerCapture(event.pointerId);
      return;
    }

    if (!currentTool) return;

    event.preventDefault();
    const pointerData = convertPointerEvent(event);
    const context = createToolContext();
    currentTool.onPointerDown(pointerData, context);

    // Update cursor if needed
    canvasElement.style.cursor = currentTool.getCursor();
  }

  /**
   * Handle pointer move event
   */
  function handlePointerMove(event: PointerEvent) {
    // Handle meta-key panning
    if (isMetaPanning) {
      const deltaX = event.clientX - metaPanStartX;
      const deltaY = event.clientY - metaPanStartY;

      // Convert screen delta to canvas delta (accounting for zoom)
      const canvasDeltaX = deltaX / metaPanCurrentZoom;
      const canvasDeltaY = deltaY / metaPanCurrentZoom;

      canvasStore.update(state => ({
        ...state,
        viewport: {
          ...state.viewport,
          x: metaPanStartViewportX - canvasDeltaX,
          y: metaPanStartViewportY - canvasDeltaY,
        }
      }));

      markDirty();
      return;
    }

    // Presentation mode: allow pan and select tools, block others
    if ($canvasStore.presentationMode && $canvasStore.activeTool !== 'select' && $canvasStore.activeTool !== 'pan') {
      canvasElement.style.cursor = 'default';
      return;
    }

    if (!currentTool) return;

    const pointerData = convertPointerEvent(event);
    const context = createToolContext();
    currentTool.onPointerMove(pointerData, context);

    // Update cursor if needed
    canvasElement.style.cursor = currentTool.getCursor();
  }

  /**
   * Handle pointer up event
   */
  function handlePointerUp(event: PointerEvent) {
    // End meta-key panning
    if (isMetaPanning) {
      isMetaPanning = false;
      canvasElement.releasePointerCapture(event.pointerId);

      // Restore cursor: show grab if meta key is still held, otherwise restore tool cursor
      if (isMetaPanKey(event)) {
        canvasElement.style.cursor = 'grab';
      } else if (currentTool) {
        canvasElement.style.cursor = currentTool.getCursor();
      } else {
        canvasElement.style.cursor = 'default';
      }
      presentationClickStart = null;
      return;
    }

    // Presentation mode: click (not drag) triggers aura highlight on shapes
    if ($canvasStore.presentationMode && presentationClickStart) {
      const dx = event.clientX - presentationClickStart.x;
      const dy = event.clientY - presentationClickStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      presentationClickStart = null;

      if (distance < 5) {
        // This was a click, not a drag - do hit detection and trigger aura
        const { x: canvasX, y: canvasY } = screenToCanvas(event.clientX, event.clientY);
        const hitShape = findShapeAtPoint($canvasStore.shapesArray, canvasX, canvasY);
        if (hitShape) {
          const bounds = getShapeBoundsForAura(hitShape);
          activeAuras.push({ shapeId: hitShape.id, startTime: performance.now(), bounds });
          markDirty();
        } else {
          // Clicked empty space - clear any active auras
          if (activeAuras.length > 0) {
            activeAuras = [];
            markDirty();
          }
        }
      }
    }

    if (!currentTool) return;

    const pointerData = convertPointerEvent(event);
    const context = createToolContext();
    currentTool.onPointerUp(pointerData, context);

    // Update cursor if needed
    canvasElement.style.cursor = currentTool.getCursor();
  }

  /**
   * Handle keyboard events (for tools like Select that need Delete key)
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (!currentTool) return;

    // Ignore keyboard shortcuts when typing in input fields or textareas
    // BUT allow Escape and tool-specific shortcuts to pass through
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

    // For input fields, only allow Escape and pass other events to the tool
    if (isInputField) {
      // For Escape, handle both canvas escape and tool escape
      if (event.key === 'Escape') {
        // Let the tool handle it first
        const keyboardData = convertKeyboardEvent(event);
        const context = createToolContext();
        currentTool.onKeyDown(keyboardData, context);
        return;
      }
      // Ignore other shortcuts (spacebar, Ctrl+Z, etc.) when typing
      return;
    }

    // Presentation mode: only allow Esc, G (grid toggle), zoom keys, Space (pan)
    if ($canvasStore.presentationMode) {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitPresentationMode();
        return;
      }
      // Allow grid toggle (G key, no modifiers)
      if (event.key.toLowerCase() === 'g' && !event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        toggleGrid();
        markDirty();
        return;
      }
      // Allow Cmd+' for grid toggle
      const isMacPres = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrlPres = isMacPres ? event.metaKey : event.ctrlKey;
      if (cmdOrCtrlPres && event.key === "'") {
        event.preventDefault();
        toggleGrid();
        markDirty();
        return;
      }
      // Allow spacebar for pan
      if (event.key === ' ' && !isSpacebarHeld) {
        event.preventDefault();
        isSpacebarHeld = true;
        previousTool = $canvasStore.activeTool;
        canvasStore.update(s => ({ ...s, activeTool: 'pan' }));
        return;
      }
      // Arrow keys for tab switching in presentation mode
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        const tabs = $tabStore.tabs;
        const activeIndex = tabs.findIndex(t => t.id === $tabStore.activeTabId);
        if (event.key === 'ArrowLeft' && activeIndex > 0) {
          switchTab(tabs[activeIndex - 1].id);
          canvasStore.update(s => ({ ...s, presentationMode: true }));
        } else if (event.key === 'ArrowRight' && activeIndex < tabs.length - 1) {
          switchTab(tabs[activeIndex + 1].id);
          canvasStore.update(s => ({ ...s, presentationMode: true }));
        }
        return;
      }
      // Block all other keys in presentation mode
      return;
    }

    // Track meta/cmd key for pan cursor feedback
    if (event.key === 'Meta' || event.key === 'Control') {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isRelevantKey = (isMac && event.key === 'Meta') || (!isMac && event.key === 'Control');
      if (isRelevantKey && !isMetaPanning && canvasElement) {
        isMetaKeyHeld = true;
        canvasElement.style.cursor = 'grab';
      }
    }

    // Handle Escape key - first let the active tool handle it (e.g., cancel
    // an in-progress connection or drawing), then fall through to switch to
    // the select tool if the current tool is something else.
    if (event.key === 'Escape') {
      event.preventDefault();

      // Always give the active tool a chance to handle Escape first
      if (currentTool) {
        const keyboardData = convertKeyboardEvent(event);
        const context = createToolContext();
        currentTool.onKeyDown(keyboardData, context);
      }

      const state = $canvasStore;

      // Only switch if not already on select tool
      if (state.activeTool !== 'select') {
        // Deactivate current tool
        if (currentTool) {
          currentTool.onDeactivate();
        }

        // Switch to select tool
        canvasStore.update(s => ({
          ...s,
          activeTool: 'select'
        }));
      }
      return;
    }

    // Handle spacebar for temporary pan mode
    if (event.key === ' ' && !isSpacebarHeld) {
      event.preventDefault();
      isSpacebarHeld = true;
      const state = $canvasStore;
      previousTool = state.activeTool;

      // Switch to pan tool temporarily
      canvasStore.update(s => ({
        ...s,
        activeTool: 'pan'
      }));
      return;
    }

    // Handle global keyboard shortcuts
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Undo: Ctrl+Z (Cmd+Z on Mac)
    if (cmdOrCtrl && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
      return;
    }

    // Redo: Ctrl+Shift+Z (Cmd+Shift+Z on Mac)
    if (cmdOrCtrl && event.key === 'z' && event.shiftKey) {
      event.preventDefault();
      handleRedo();
      return;
    }

    // Copy: Ctrl+C (Cmd+C on Mac)
    if (cmdOrCtrl && event.key === 'c') {
      event.preventDefault();
      handleCopy();
      return;
    }

    // Paste: Ctrl+V (Cmd+V on Mac)
    // Let the native paste event fire so both image paste and shape paste work
    // via the window 'paste' event handler
    if (cmdOrCtrl && event.key === 'v') {
      return;
    }

    // Duplicate: Ctrl+D (Cmd+D on Mac)
    if (cmdOrCtrl && event.key === 'd') {
      event.preventDefault();
      handleDuplicate();
      return;
    }

    // Toggle grid: Ctrl+' (Cmd+' on Mac)
    if (cmdOrCtrl && event.key === "'") {
      event.preventDefault();
      toggleGrid();
      markDirty();
      return;
    }

    // Presentation mode: Cmd+Shift+P
    if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      enterPresentationMode();
      return;
    }

    // Tool switching shortcuts (single letter, no modifiers)
    if (!cmdOrCtrl && !event.altKey && !event.shiftKey) {
      const toolShortcuts: Record<string, ToolType> = {
        'v': 'select',
        'r': 'rectangle',
        'e': 'ellipse',
        'g': 'triangle',
        'i': 'diamond',
        'x': 'hexagon',
        'p': 'star',
        'c': 'cloud',
        'y': 'cylinder',
        'l': 'line',
        'a': 'arrow',
        'd': 'freedraw',
        't': 'text',
        's': 'sticky',
        'h': 'pan',
      };

      const toolId = toolShortcuts[event.key.toLowerCase()];
      if (toolId) {
        event.preventDefault();
        canvasStore.update(s => ({
          ...s,
          activeTool: toolId
        }));
        return;
      }
    }

    const keyboardData = convertKeyboardEvent(event);
    const context = createToolContext();
    currentTool.onKeyDown(keyboardData, context);
  }

  function handleKeyUp(event: KeyboardEvent) {
    // Track meta/cmd key release for pan cursor feedback
    if (event.key === 'Meta' || event.key === 'Control') {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isRelevantKey = (isMac && event.key === 'Meta') || (!isMac && event.key === 'Control');
      if (isRelevantKey && isMetaKeyHeld) {
        isMetaKeyHeld = false;
        // If we were mid-pan, the pointerUp handler will restore the cursor.
        // Otherwise, restore to the active tool's cursor now.
        if (!isMetaPanning && canvasElement && currentTool) {
          canvasElement.style.cursor = currentTool.getCursor();
        }
      }
    }

    if (!currentTool) return;

    // Ignore keyboard shortcuts when typing in input fields or textareas
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    if (isInputField) {
      return;
    }

    // Handle spacebar release to return to previous tool
    if (event.key === ' ' && isSpacebarHeld) {
      event.preventDefault();
      isSpacebarHeld = false;

      // Return to previous tool
      if (previousTool) {
        const tool = previousTool;
        canvasStore.update(s => ({
          ...s,
          activeTool: tool
        }));
        previousTool = null;
      }
      return;
    }

    const keyboardData = convertKeyboardEvent(event);
    const context = createToolContext();
    currentTool.onKeyUp(keyboardData, context);
  }

  /**
   * Handle undo action
   */
  function handleUndo() {
    if (historyManager.canUndo()) {
      historyManager.undo();
      markDirty();
    }
  }

  /**
   * Handle redo action
   */
  function handleRedo() {
    if (historyManager.canRedo()) {
      historyManager.redo();
      markDirty();
    }
  }

  /**
   * Handle copy action
   */
  function handleCopy() {
    const state = $canvasStore;
    if (state.selectedIds.size === 0) return;

    // Get selected shapes
    const selectedShapes = Array.from(state.selectedIds)
      .map(id => state.shapes.get(id))
      .filter((shape): shape is any => shape !== undefined);

    // Store as JSON in sessionStorage (clipboard API has limitations)
    try {
      sessionStorage.setItem('napkin-clipboard', JSON.stringify(selectedShapes));
      console.log(`Copied ${selectedShapes.length} shape(s)`);
    } catch (error) {
      console.error('Failed to copy shapes:', error);
    }
  }

  /**
   * Handle paste action
   */
  function handlePaste() {
    try {
      const clipboardData = sessionStorage.getItem('napkin-clipboard');
      if (!clipboardData) return;

      const shapes = JSON.parse(clipboardData);
      if (!Array.isArray(shapes) || shapes.length === 0) return;

      const commands = [];
      const newShapeIds = new Set<string>();

      // Create new shapes with offset and new IDs
      const offset = 20;
      for (const shape of shapes) {
        const newId = generateShapeId();
        const newShape = {
          ...shape,
          id: newId,
          x: shape.x + offset,
          y: shape.y + offset,
        };

        // Handle shapes with x2, y2 (lines and arrows)
        if ('x2' in shape && 'y2' in shape) {
          newShape.x2 = shape.x2 + offset;
          newShape.y2 = shape.y2 + offset;
        }

        // Handle control points for routed lines/arrows
        if ('controlPoints' in shape && Array.isArray(shape.controlPoints)) {
          newShape.controlPoints = shape.controlPoints.map((cp: any) => ({
            x: cp.x + offset,
            y: cp.y + offset,
          }));
        }

        commands.push(new AddShapeCommand(newShape));
        newShapeIds.add(newId);
      }

      // Execute as batch command
      if (commands.length > 0) {
        historyManager.execute(new BatchCommand(commands));

        // Select the pasted shapes
        canvasStore.update(s => ({
          ...s,
          selectedIds: newShapeIds,
        }));

        markDirty();
        console.log(`Pasted ${commands.length} shape(s)`);
      }
    } catch (error) {
      console.error('Failed to paste shapes:', error);
    }
  }

  /**
   * Handle duplicate action
   */
  function handleDuplicate() {
    const state = $canvasStore;
    if (state.selectedIds.size === 0) return;

    // Get selected shapes
    const selectedShapes = Array.from(state.selectedIds)
      .map(id => state.shapes.get(id))
      .filter((shape): shape is any => shape !== undefined);

    const commands = [];
    const newShapeIds = new Set<string>();

    // Create new shapes with offset and new IDs
    const offset = 20;
    for (const shape of selectedShapes) {
      const newId = generateShapeId();
      const newShape: any = {
        ...shape,
        id: newId,
        x: shape.x + offset,
        y: shape.y + offset,
      };

      // Handle shapes with x2, y2 (lines and arrows)
      if ('x2' in shape && 'y2' in shape) {
        newShape.x2 = shape.x2 + offset;
        newShape.y2 = shape.y2 + offset;
      }

      // Handle freedraw shapes with points
      if (shape.type === 'freedraw' && 'points' in shape) {
        newShape.points = shape.points.map((p: { x: number; y: number }) => ({
          x: p.x + offset,
          y: p.y + offset,
        }));
      }

      // Handle control points for routed lines/arrows
      if ('controlPoints' in shape && Array.isArray(shape.controlPoints)) {
        newShape.controlPoints = shape.controlPoints.map((cp: any) => ({
          x: cp.x + offset,
          y: cp.y + offset,
        }));
      }

      commands.push(new AddShapeCommand(newShape));
      newShapeIds.add(newId);
    }

    // Execute as batch command
    if (commands.length > 0) {
      historyManager.execute(new BatchCommand(commands));

      // Select the duplicated shapes
      canvasStore.update(s => ({
        ...s,
        selectedIds: newShapeIds,
      }));

      markDirty();
      console.log(`Duplicated ${commands.length} shape(s)`);
    }
  }

  /**
   * Handle mouse wheel zoom
   */
  function handleWheel(event: WheelEvent) {
    // Check if Ctrl/Cmd is pressed for zoom
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();

      const state = $canvasStore;
      const rect = canvasElement.getBoundingClientRect();

      // Get mouse position in screen space
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Get mouse position in canvas space before zoom
      const canvasXBefore = mouseX / state.viewport.zoom + state.viewport.x;
      const canvasYBefore = mouseY / state.viewport.zoom + state.viewport.y;

      // Calculate new zoom (negative deltaY = zoom in)
      const zoomDelta = -event.deltaY * 0.001;
      const newZoom = Math.max(0.1, Math.min(10, state.viewport.zoom * (1 + zoomDelta)));

      // Get mouse position in canvas space after zoom
      const canvasXAfter = mouseX / newZoom + state.viewport.x;
      const canvasYAfter = mouseY / newZoom + state.viewport.y;

      // Adjust viewport to keep mouse position fixed
      const viewportX = state.viewport.x + (canvasXBefore - canvasXAfter);
      const viewportY = state.viewport.y + (canvasYBefore - canvasYAfter);

      // Update viewport with new zoom and position
      canvasStore.update(s => ({
        ...s,
        viewport: {
          x: viewportX,
          y: viewportY,
          zoom: newZoom
        }
      }));

      markDirty();
    }
  }

  /**
   * Handle context menu (right-click)
   */
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();

    // Show context menu at cursor position
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    contextMenuVisible = true;
  }

  /**
   * Handle drag over for image drop
   */
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  /**
   * Handle drop for images
   */
  async function handleDrop(event: DragEvent) {
    event.preventDefault();

    const state = $canvasStore;
    const canvasRect = canvasElement.getBoundingClientRect();
    const canvasX = (event.clientX - canvasRect.left - state.viewport.x) / state.viewport.zoom;
    const canvasY = (event.clientY - canvasRect.top - state.viewport.y) / state.viewport.zoom;

    const imageShape = await handleImageDrop(event, canvasX, canvasY);
    if (imageShape) {
      historyManager.execute(new AddShapeCommand(imageShape));
      canvasStore.update(s => ({
        ...s,
        selectedIds: new Set([imageShape.id]),
      }));
      markDirty();
    }
  }

  /**
   * Close context menu
   */
  function closeContextMenu() {
    contextMenuVisible = false;
  }

  /**
   * Close help dialog
   */
  function closeHelpDialog() {
    helpDialogVisible = false;
  }

  /**
   * Start text editing for a shape
   */
  function startTextEditing(shapeId: string) {
    const state = $canvasStore;
    const shape = state.shapes.get(shapeId);
    if (!shape) return;

    // Don't allow text editing on freedraw shapes
    if (shape.type === 'freedraw') return;

    editingShapeId = shapeId;
    editingText = (shape as any).text || '';
    editingShapeType = shape.type;

    // Set font properties based on shape type
    if (shape.type === 'text') {
      textFontSize = (shape as any).fontSize || 20;
      textFontFamily = (shape as any).fontFamily || 'Arial, sans-serif';
      textAlign = 'left';
    } else if (shape.type === 'sticky') {
      textFontSize = (shape as any).fontSize || 14;
      textFontFamily = 'sans-serif';
      textAlign = 'left';
    } else {
      textFontSize = (shape as any).fontSize || 14;
      textFontFamily = (shape as any).fontFamily || 'sans-serif';
      textAlign = 'center';
    }

    // Calculate position and size for text editor
    const rect = canvasElement.getBoundingClientRect();
    const { x: viewX, y: viewY, zoom } = state.viewport;

    // Get shape bounds in canvas coordinates
    let shapeX = shape.x;
    let shapeY = shape.y;
    let shapeWidth = 100;
    let shapeHeight = 50;

    if (shape.type === 'rectangle' || shape.type === 'ellipse' ||
        shape.type === 'triangle' || shape.type === 'diamond' ||
        shape.type === 'hexagon' || shape.type === 'star' ||
        shape.type === 'cloud' || shape.type === 'cylinder' ||
        shape.type === 'text' || shape.type === 'sticky') {
      shapeWidth = (shape as any).width || 100;
      shapeHeight = (shape as any).height || 50;
    } else if (shape.type === 'line' || shape.type === 'arrow') {
      // For lines/arrows, center the editor on the midpoint
      const lineShape = shape as any;
      const midX = (shape.x + lineShape.x2) / 2;
      const midY = (shape.y + lineShape.y2) / 2;
      // Use a reasonable fixed size for the text box on lines
      shapeWidth = Math.max(150, Math.abs(lineShape.x2 - shape.x) * 0.6);
      shapeHeight = Math.max(40, textFontSize * 2.5);
      shapeX = midX - shapeWidth / 2;
      shapeY = midY - shapeHeight / 2;
    }

    // Calculate vertical padding to match where text renders based on verticalAlign.
    // This prevents the textarea from appearing at a different position than the rendered text.
    const vAlign = (shape as any).verticalAlign || 'middle';
    textVerticalAlign = vAlign;
    const padding = 10;

    if (shape.type !== 'line' && shape.type !== 'arrow') {
      // Estimate text height for padding calculation
      const lineHeight = textFontSize * 1.2;
      const existingLines = ((shape as any).text || '').split('\n');
      const estimatedTextHeight = Math.max(1, existingLines.length) * lineHeight;

      if (vAlign === 'top') {
        textPaddingTop = padding;
      } else if (vAlign === 'bottom') {
        textPaddingTop = Math.max(padding, shapeHeight - padding - estimatedTextHeight);
      } else {
        // middle — center the text area content vertically
        textPaddingTop = Math.max(padding, (shapeHeight - estimatedTextHeight) / 2);
      }
    } else {
      textPaddingTop = 4; // Default for lines/arrows
    }

    // Convert canvas coordinates to screen coordinates
    // The viewport transform is: screenX = (canvasX - viewX) * zoom
    // Offset by the canvas element's position on the page
    textPosition.x = (shapeX - viewX) * zoom + rect.left;
    textPosition.y = (shapeY - viewY) * zoom + rect.top;
    textSize.width = shapeWidth * zoom;
    textSize.height = shapeHeight * zoom;

    // Focus the textarea after a small delay
    setTimeout(() => {
      const textarea = document.querySelector('.text-editor') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    }, 50);
  }

  /**
   * Finish text editing
   */
  async function finishTextEditing() {
    // Re-entry guard - prevent multiple simultaneous calls
    if (!editingShapeId || finishingTextEdit) return;

    // Set flag immediately to prevent concurrent calls
    finishingTextEdit = true;

    // Capture state before clearing
    const shapeId = editingShapeId;
    const text = editingText;

    // Clear editing state
    editingShapeId = null;
    editingText = '';

    try {
      const state = $canvasStore;
      const shape = state.shapes.get(shapeId);

      if (!shape) return;

      if (text !== undefined) {
        // Only update if we have text to save (even if empty string is intentional)
        try {
          historyManager.execute(new ModifyShapeCommand(shapeId, { text }));
          markDirty();
        } catch (error) {
          console.error('Failed to update shape text:', error);
        }
      } else {
        markDirty();
      }
    } finally {
      // Always clear flag, even if error occurs
      finishingTextEdit = false;
    }
  }

  /**
   * Handle keys in text editor
   */
  function handleTextEditorKeyDown(event: KeyboardEvent) {
    // Stop all keyboard events from propagating to prevent shortcuts
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      finishTextEditing();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      // Enter without Shift finishes editing
      event.preventDefault();
      finishTextEditing();
    }
    // Shift+Enter allows newlines
  }
</script>

<svelte:window
  on:keydown={(e) => {
    // Handle ? key for help dialog
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      helpDialogVisible = true;
      return;
    }
    handleKeyDown(e);
  }}
  on:keyup={handleKeyUp}
  on:blur={() => {
    // Reset meta key state when window loses focus (e.g., Cmd+Tab on Mac)
    if (isMetaKeyHeld) {
      isMetaKeyHeld = false;
      if (!isMetaPanning && canvasElement && currentTool) {
        canvasElement.style.cursor = currentTool.getCursor();
      }
    }
  }}
/>

<canvas
  bind:this={canvasElement}
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
  on:wheel={handleWheel}
  on:contextmenu={handleContextMenu}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  class="canvas"
/>

{#if showMultiSelectToolbar}
  <MultiSelectToolbar
    shapes={multiSelectShapes}
    screenX={multiSelectToolbarX}
    screenY={multiSelectToolbarY}
    onAlign={(updates) => updateShapes(updates)}
    onGroup={handleToolbarGroup}
    onUngroup={handleToolbarUngroup}
    onDelete={() => handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))}
  />
{/if}

{#if editingShapeId}
  <textarea
    class="text-editor {editingShapeType === 'sticky' ? 'text-editor--sticky' : ''} {editingShapeType === 'line' || editingShapeType === 'arrow' ? 'text-editor--line' : ''}"
    bind:value={editingText}
    on:blur={finishTextEditing}
    on:keydown={handleTextEditorKeyDown}
    style="
      position: fixed;
      left: {textPosition.x}px;
      top: {textPosition.y}px;
      width: {textSize.width}px;
      height: {textSize.height}px;
      font-size: {textFontSize * $canvasStore.viewport.zoom}px;
      font-family: {textFontFamily};
      text-align: {textAlign};
      padding-top: {textPaddingTop * $canvasStore.viewport.zoom}px;
      box-sizing: border-box;
    "
  />
{/if}

<ContextMenu
  bind:this={contextMenuComponent}
  bind:visible={contextMenuVisible}
  x={contextMenuX}
  y={contextMenuY}
/>

<HelpDialog
  bind:this={helpDialogComponent}
  bind:visible={helpDialogVisible}
/>

<style>
  .canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .text-editor {
    border: 2px solid rgba(33, 150, 243, 0.5);
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 10px;
    font-size: 14px;
    font-family: sans-serif;
    text-align: center;
    resize: none;
    overflow: hidden;
    z-index: 10000;
    border-radius: 2px;
    color: #000000;
    line-height: 1.2;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .text-editor:focus {
    outline: none;
    border-color: rgba(25, 118, 210, 0.6);
    background: rgba(255, 255, 255, 0.15);
  }

  /* Sticky notes: left-aligned text with padding */
  .text-editor--sticky {
    text-align: left;
    padding: 10px;
  }

  /* Lines/arrows: slightly more visible background since there's no shape fill */
  .text-editor--line {
    background: rgba(255, 255, 255, 0.5);
    border: 1px dashed rgba(33, 150, 243, 0.6);
  }
</style>
