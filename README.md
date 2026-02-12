# Napkin

A fast, local-first drawing and diagramming app. Sketch ideas, map out systems, and create diagrams — all without accounts, cloud sync, or network requests. Your data stays on your machine.

## Why Napkin

- **Instant and private** — opens immediately, works offline, nothing leaves your computer
- **Hand-drawn feel** — rough.js rendering gives diagrams a natural, sketchy look
- **Desktop native** — built with Tauri so it runs as a real app, not a browser tab
- **Simple file format** — `.napkin` files are just JSON, easy to version control or script against

## What you can do

- Draw shapes (rectangles, ellipses, triangles, diamonds, hexagons, stars, clouds, cylinders, sticky notes)
- Connect them with lines and arrows (direct, elbow, or curved routing)
- Add text to any shape or as standalone labels
- Freehand drawing for quick sketches
- Resize, rotate, snap, align, and style everything
- Undo/redo, copy/paste, duplicate
- Export to PNG or SVG
- Save and open `.napkin` files with native file dialogs

## Getting started

Requires Node.js 18+ and Rust (for Tauri).

```bash
npm install
npm run tauri dev
```

To run in the browser only (no native features):

```bash
npm run dev
```

## Build

```bash
npm run tauri build
```

Produces `Napkin.app` and `.dmg` in `src-tauri/target/release/bundle/macos/`.

## License

MIT
