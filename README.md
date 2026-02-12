<p align="center">
  <img src="public/favicon.svg" alt="Napkin logo" width="128" height="128">
</p>

<h1 align="center">Napkin</h1>

<p align="center">
  A fast, local-first drawing and diagramming app. Sketch ideas, map out systems, and create diagrams — all without accounts, cloud sync, or network requests. Your data stays on your machine.
</p>

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
- Paste images from clipboard directly onto the canvas
- Multiple tabs with collection save/restore
- Configurable fill styles (hachure, solid, zigzag, cross-hatch, dots)
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

Produces `Napkin.app` and `.dmg` on macOS, `.msi`/`.exe` on Windows, and `.deb`/`.AppImage` on Linux in `src-tauri/target/release/bundle/`.

## License

[MIT](LICENSE)
