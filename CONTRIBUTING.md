# Contributing to Napkin

Thanks for your interest in contributing! This guide covers everything you need to set up a development environment and submit changes.

## Prerequisites

- **Node.js 18+**
- **Rust** (stable) — install via [rustup](https://rustup.rs/)
- **Platform dependencies** (Linux only):
  ```bash
  sudo apt-get install -y \
    libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
    patchelf libgtk-3-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
  ```

## Setup

```bash
git clone https://github.com/ipcrm/napkin.git
cd napkin
npm install
```

## Development

Run the full desktop app (Tauri + frontend hot-reload):

```bash
npm run tauri dev
```

Run the frontend only in a browser (no native file dialogs or menus):

```bash
npm run dev
```

## Useful commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server on `:5173` |
| `npm run build` | Production frontend build to `dist/` |
| `npm run tauri dev` | Full Tauri dev mode (Rust + frontend) |
| `npm run tauri build` | Production build → `.app` / `.dmg` / `.msi` / `.deb` |
| `npm run check` | TypeScript / Svelte type checking |
| `npm test` | Run tests |

## Project structure

```
src/
├── main.ts                    # Svelte app entry
├── App.svelte                 # Root component
├── components/                # UI components (Canvas, Toolbar, Sidebar, etc.)
├── lib/
│   ├── types.ts               # TypeScript type definitions
│   ├── state/                 # Svelte stores (canvasStore, history, tabStore)
│   ├── tools/                 # Tool classes (select, rectangle, arrow, etc.)
│   ├── shapes/                # Shape geometry and bounds
│   ├── canvas/                # Rendering, hit detection, stroke styles
│   ├── utils/                 # Routing, snapping, alignment helpers
│   ├── storage/               # File I/O (Tauri native + browser fallback)
│   └── export/                # PNG/SVG export
src-tauri/
├── src/lib.rs                 # Rust entry: plugins, native menu
├── tauri.conf.json            # Tauri window/bundle config
└── capabilities/default.json  # Permission scopes
```

## Tech stack

- **Desktop framework**: Tauri 2.x (Rust)
- **Frontend**: Svelte 4 + TypeScript, bundled with Vite 5
- **Rendering**: HTML5 Canvas 2D + rough.js
- **State**: Svelte writable stores with command-pattern undo/redo

## Architecture notes

- All tools extend the abstract `Tool` class in `src/lib/tools/toolBase.ts`
- `Canvas.svelte` is the central orchestrator — pointer/keyboard events flow through it to the active tool
- State lives in `canvasStore` (Svelte writable); history uses a command pattern (`history.ts`)
- Hit detection is two-pass: lines first (wider threshold), then filled shapes
- See `CLAUDE.md` for detailed architecture documentation

## Submitting changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run check` and `npm test` to verify
4. Open a pull request against `main`

## Building for release

```bash
npm run tauri build
```

Output is in `src-tauri/target/release/bundle/` — `.app`/`.dmg` on macOS, `.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux.
