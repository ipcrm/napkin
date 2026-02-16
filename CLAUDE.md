# Napkin - Local Drawing Application

## Overview

Napkin is a desktop drawing/diagramming application built with **Tauri 2.x** (Rust backend) + **Svelte 4** (TypeScript frontend). It uses **HTML5 Canvas 2D** with **rough.js** for a hand-drawn/sketchy visual style. All data stays local - no cloud, no accounts.

## Tech Stack

- **Desktop framework**: Tauri 2.x (Rust), identifier: `com.napkin.desktop`
- **Frontend**: Svelte 4 + TypeScript, bundled with Vite 5
- **Rendering**: HTML5 Canvas 2D + rough.js 4.6
- **Tauri plugins**: `tauri-plugin-dialog` (native file dialogs), `tauri-plugin-fs` (file system)
- **State management**: Svelte writable stores (`canvasStore`, `historyManager`)
- **File format**: `.napkin` (JSON)

## Build & Run Commands

```bash
npm run dev            # Vite dev server on :5173
npm run build          # Vite production build to dist/
npm run tauri dev      # Full Tauri dev mode (Rust + frontend)
npm run tauri build    # Production Tauri build → .app + .dmg
npm run check          # svelte-check TypeScript validation
```

Build output: `src-tauri/target/release/bundle/macos/Napkin.app`

## Project Structure

```
src/
├── main.ts                          # Svelte app entry point
├── App.svelte                       # Root component (header, menu, canvas, sidebar)
├── components/
│   ├── Canvas.svelte                # Central canvas (~2200+ lines): rendering, events, text editing
│   ├── Toolbar.svelte               # Left toolbar with tool buttons and flyouts
│   ├── Sidebar.svelte               # Right panel: properties, styles, colors (collapsible sections)
│   ├── Menu.svelte                  # File menu dropdown (New/Open/Save As/Export)
│   ├── ContextMenu.svelte           # Right-click context menu
│   ├── HelpDialog.svelte            # Keyboard shortcuts help
│   ├── ToolIcon.svelte              # 18 inline SVG icons for all tools
│   ├── ToolFlyout.svelte            # Flyout submenu for shape/line groups
│   └── sidebar/                     # Sidebar sub-components
│       ├── ColorPicker.svelte
│       ├── EndpointSelector.svelte  # Line endpoint shape picker + size
│       ├── RoutingModeButtons.svelte # Direct/Elbow/Curved
│       ├── RecentColorsPalette.svelte
│       ├── StrokeStyleButtons.svelte
│       └── ...
├── lib/
│   ├── types.ts                     # All TypeScript type definitions (Shape, ToolType, etc.)
│   ├── state/
│   │   ├── canvasStore.ts           # Main Svelte store: CanvasState, shape CRUD helpers
│   │   └── history.ts              # Undo/redo with command pattern
│   ├── tools/
│   │   ├── toolBase.ts             # Abstract Tool class with lifecycle methods
│   │   ├── selectTool.ts           # Select tool (~1850 lines): drag, resize, rotate, connect, endpoint mgmt
│   │   ├── rectangleTool.ts        # Shape creation tools (one per shape type)
│   │   ├── arrowTool.ts
│   │   ├── lineTool.ts
│   │   ├── stickyNoteTool.ts
│   │   └── ...
│   ├── shapes/
│   │   ├── rectangle.ts, ellipse.ts, triangle.ts, diamond.ts, hexagon.ts
│   │   ├── star.ts, cloud.ts, cylinder.ts, stickyNote.ts
│   │   ├── line.ts, arrow.ts, freedraw.ts, text.ts
│   │   └── bounds.ts              # Bounding box calculations
│   ├── canvas/
│   │   ├── roughRenderer.ts        # rough.js rendering for all shape types
│   │   ├── hitDetection.ts         # Two-pass hit detection (lines first, then shapes)
│   │   ├── endpointRenderer.ts     # Shared endpoint shape renderer (7 types)
│   │   ├── strokeStyles.ts         # Stroke dash patterns
│   │   └── shapeRenderer.ts
│   ├── utils/
│   │   ├── routing.ts             # Line routing: direct, elbow (orthogonal), curved (bezier)
│   │   ├── angleSnap.ts           # 90-degree snap detection (3-degree threshold)
│   │   ├── binding.ts             # Arrow/line ↔ shape binding helpers
│   │   ├── snapping.ts            # Smart guides, alignment snap, distribution (equal spacing) snap
│   │   ├── layout.ts              # Auto-layout algorithms (grid, force-directed)
│   │   └── alignment.ts, debounce.ts
│   ├── storage/
│   │   ├── tauriFile.ts           # Native file dialogs (save/open/export)
│   │   ├── jsonExport.ts          # JSON serialization/deserialization
│   │   ├── autoSave.ts            # Auto-save to Tauri app data
│   │   └── indexedDB.ts           # Browser fallback storage
│   └── export/
│       ├── png.ts, svg.ts
│       └── workers/exportWorker.ts # Web worker for export rendering
src-tauri/
├── tauri.conf.json                  # Tauri config: window, bundle, build commands
├── capabilities/default.json        # Permissions: dialog, fs with scope ($HOME, $DESKTOP, etc.)
├── src/lib.rs                       # Rust entry: plugins, native menu, menu event → webview emit
└── Cargo.toml                       # Rust deps: tauri 2.10, plugin-dialog, plugin-fs
```

## Architecture

### Tool System

All tools extend the abstract `Tool` class (`src/lib/tools/toolBase.ts`):

```typescript
abstract class Tool {
  onActivate(): void
  onDeactivate(): void
  abstract onPointerDown(event: PointerEventData, context: ToolContext): void
  abstract onPointerMove(event: PointerEventData, context: ToolContext): void
  abstract onPointerUp(event: PointerEventData, context: ToolContext): void
  onKeyDown(event: KeyboardEventData, context: ToolContext): void  // optional
  onKeyUp(event: KeyboardEventData, context: ToolContext): void    // optional
  renderOverlay(ctx: CanvasRenderingContext2D, context: ToolContext): void // optional
  getCursor(): string
}
```

Tools are instantiated once in `Canvas.svelte` and reused. The active tool receives all pointer/keyboard events from Canvas.svelte's event handlers.

### Canvas.svelte Event Flow

`Canvas.svelte` is the central orchestrator:
1. Pointer events → converted to canvas coordinates (accounting for viewport pan/zoom) → dispatched to active tool
2. Keyboard events → `handleKeyDown()` processes global shortcuts first, then tool shortcuts, then falls through to `currentTool.onKeyDown()`
3. Render loop: `requestAnimationFrame` with dirty flag, renders all shapes via rough.js

### State Management

- **`canvasStore`** (Svelte writable): `CanvasState` with `shapes` (Map), `shapesArray` (z-order array), `selectedIds` (Set), `viewport`, `activeTool`, `stylePreset`, `showGrid`, `snapToGrid`, `alignmentHints`, `objectSnap`
- **`historyManager`**: Command pattern undo/redo with `AddShapeCommand`, `ModifyShapeCommand`, `DeleteShapeCommand`, `BatchCommand`
- Shape CRUD: `addShape()`, `updateShape()`, `removeShape()`, `removeShapes()` in canvasStore.ts

### Shape Types

13 shape types: `rectangle`, `ellipse`, `triangle`, `diamond`, `hexagon`, `star`, `cloud`, `cylinder`, `sticky`, `line`, `arrow`, `freedraw`, `text`

All extend `BaseShape` with `id`, `type`, `x`, `y`, `strokeColor`, `strokeWidth`, `fillColor`, `opacity`, `rotation`, `roughness`, `text`, `textAlign`, `verticalAlign`.

Lines and arrows additionally have: `x2`, `y2`, `bindStart`, `bindEnd` (Binding to shapes), `routingMode`, `controlPoints`, `startEndpoint`, `endEndpoint`.

### Connection/Binding System

- Shapes expose 5 connection points: `top`, `right`, `bottom`, `left`, `center`
- Lines/arrows store bindings as `{ shapeId, point: ConnectionPoint }`
- Fully-bound lines (both endpoints bound) cannot be dragged freely - must release an endpoint first
- Endpoint release is HIGHEST PRIORITY in SelectTool.onPointerDown (above connection point click)

### Hit Detection

Two-pass system in `hitDetection.ts`:
1. First pass: lines/arrows with 10px proximity threshold (thin shapes need wider hit area)
2. Second pass: filled shapes (rectangles, ellipses, etc.)

This prevents filled shapes from "stealing" clicks meant for lines drawn over them.

### Rendering

- rough.js for sketchy/hand-drawn style (`roughness` 0-3)
- Text on lines/arrows: line path splits into two segments around text (gap under text)
- Line routing: direct (straight), elbow (orthogonal segments), curved (quadratic bezier via control points)
- Endpoint shapes: 7 types (none, arrow, open-arrow, triangle, circle, diamond, square) with configurable size
- Grid: 20px spacing, subtle gray lines, toggled via `showGrid` in canvasStore
- Smart guides: pink dashed lines when edges/centers align with other shapes
- Distribution snap: spacing arrows shown when equal gaps detected between 3+ shapes

### Snapping System

Three independent toggles in the sidebar View section (persisted via localStorage):

- **Snap to Grid** (`snapToGrid`): Snaps shape position and resize edges to the 20px grid
- **Alignment Hints** (`alignmentHints`): Shows pink dashed guide lines when shape edges or centers align with nearby shapes. Also shows spacing indicators (pink arrows with pixel labels) when equal spacing is detected
- **Object Snap** (`objectSnap`): Magnetically snaps shapes to aligned positions (applies the snap, not just shows guides)

Implementation: `ToolContext.snapSettings` carries the three booleans + `gridSize` to tools. `SelectTool.onPointerMove` applies grid snap first, then alignment/distribution snap via `calculateDistributionSnap()` in `snapping.ts`. Guides are rendered in `SelectTool.renderOverlay` via `renderSnapGuides()`.

Distribution snap uses 2x the alignment threshold for easier triggering. When a spacing match is found, ALL adjacent pairs with matching gaps are highlighted (not just the pair nearest to the moving shape).

### Auto-Layout

`layout.ts` provides two algorithms available via context menu and MCP:

- **Grid layout**: Arranges shapes in rows with configurable padding (default 40px, 20px grid)
- **Force-directed layout**: Positions shapes based on connections using spring/repulsion physics

## Keyboard Shortcuts

Defined in `Canvas.svelte` handleKeyDown and `Toolbar.svelte` (display labels):

| Key | Tool | Key | Tool |
|-----|------|-----|------|
| V | Select | L | Line |
| R | Rectangle | A | Arrow |
| E | Ellipse | D | Freedraw |
| G | Triangle | T | Text |
| I | Diamond | S | Sticky Note |
| X | Hexagon | H | Pan |
| P | Star | Space | Temp pan (hold) |
| C | Cloud | Escape | Cancel / Select |
| Y | Cylinder | | |

Modifier shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo), Cmd+C (copy), Cmd+V (paste), Cmd+D (duplicate), Cmd+' (toggle grid), Cmd+drag (pan canvas).

Shortcuts only fire when: no modifier keys held (for tool shortcuts), not typing in input/textarea fields.

### SelectTool onPointerDown Priority Order

This ordering is critical and has been a source of bugs:
1. `isConnecting` second-click (complete arrow connection)
2. **Fully-bound endpoint release** (highest priority for bound lines)
3. Partially-bound endpoint drag
4. Connection point click (start new arrow from shape)
5. Resize/rotate handle click
6. Control point click (routing)
7. Shape click / box selection start

## Tauri Integration

### Tauri 2.x Specifics

- **`isTauri()` check**: Uses `'__TAURI_INTERNALS__' in window` (NOT `__TAURI__` which was Tauri 1.x)
- **Plugins**: dialog (native save/open dialogs), fs (file read/write)
- **Capabilities** (`src-tauri/capabilities/default.json`): fs:scope allows `$HOME`, `$DESKTOP`, `$DOCUMENT`, `$DOWNLOAD`, `$APPDATA`
- **Native menu**: Built in Rust (`lib.rs`), emits events (`menu-save`, `menu-open`, etc.) to webview
- **File format**: `.napkin` extension, JSON content

### Vite Config

- Path aliases: `$lib` → `/src/lib`, `@` → `/src`
- Base: `./` (relative, required for Tauri)
- Build target: es2021, chrome100, safari13

## Common Pitfalls & Lessons Learned

1. **Tauri 2 uses `__TAURI_INTERNALS__`**, not `__TAURI__`. Using the wrong global makes `isTauri()` return false, causing silent fallback to browser mode (no native dialogs).

2. **SelectTool pointer event priority matters enormously.** Connection points on shapes overlap with line endpoints. If connection point click fires before endpoint release, you can never release a bound endpoint. Always put endpoint release at highest priority.

3. **Two-pass hit detection is necessary.** Lines are thin and easily occluded by filled shapes in single-pass back-to-front iteration. Check lines first with a wider threshold.

4. **Keyboard shortcuts need explicit wiring.** Defining `shortcut: 'V'` in Toolbar.svelte is display-only. The actual key→tool mapping lives in `Canvas.svelte` handleKeyDown. Both must be kept in sync.

5. **`canvasStore.update()` with spread** is the standard pattern for state changes. Tools receive a `ToolContext` with helper methods but Canvas.svelte also calls `canvasStore.update()` directly for global operations.

6. **Sidebar sections use localStorage** key `napkin_collapsed_sections` for persistence of collapsed/expanded state.

7. **Text editing overlay**: When double-clicking a shape, a `<textarea>` is positioned exactly over the shape bounds (accounting for zoom). Canvas suppresses rendering the shape's text during editing. Guard against re-entry with `finishingTextEdit` flag.

8. **rough.js canvas must be reset** between frames via `resetRoughCanvas()` to avoid stale state.

9. **Selection aura is presentation-mode only.** The blue halo animation on shape selection must be gated behind `state.presentationMode`. Without the guard, it fires on every click in edit mode, causing a visual flash that interferes with immediate click-to-drag.

10. **`title` tooltips don't work in Tauri webview.** Use CSS `::after` pseudo-elements with `data-tooltip` attributes instead of native `title` for hover tooltips.

11. **Click-to-drag needs effective selection.** When `onPointerDown` selects a new shape via `setSelectedIds`, the `context.selectedIds` snapshot is stale. `storeSelectedShapePositions` must use the new selection set, not `context.selectedIds`, or the first click will select without enabling drag.

## Style & Conventions

- Svelte 4 syntax (not Svelte 5 runes)
- TypeScript strict mode
- Path alias `$lib` for imports from `src/lib/`
- CSS scoped to components via `<style>` blocks
- Colors: UI uses `#1a73e8` (active blue), `#e8f0fe` (active bg), `#555`/`#333` (text)
- Default shape roughness: 1 (slight sketch feel)
- All shape IDs: `shape_{timestamp}_{counter}`
