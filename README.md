<p align="center">
  <img src="public/favicon.svg" alt="Napkin logo" width="128" height="128">
</p>

<h1 align="center">Napkin</h1>

<p align="center">
  <em>From thought to diagram in seconds — entirely offline.</em>
</p>

<p align="center">
  A fast, local-first drawing and diagramming app. Sketch ideas, map out systems, and create diagrams — all without accounts, cloud sync, or network requests. Your data stays on your machine.
</p>

<p align="center">
  <img src="public/screenshot.png" alt="Napkin screenshot" width="800">
</p>

## Download

Get the latest build for your platform from [GitHub Releases](https://github.com/ipcrm/napkin/releases):

## Documentation

Full docs are available at **[ipcrm.github.io/napkin](https://ipcrm.github.io/napkin/)**.

## Features

- Simple shape library including geometric primitives, connectors, sticky notes, freehand drawing, and text
- Hand-drawn sketch style powered by rough.js
- Connectors that bind to shapes and stay attached when you move them
- Direct, elbow, and curved line routing
- Multiple tabs for organizing diagrams
- Export to PNG, SVG, and `.napkin` (JSON) files
- Keyboard shortcuts for every tool
- Grid snapping and alignment guides
- Fully offline — no accounts, no cloud, no tracking

## MCP Server

Napkin includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets AI agents create and manipulate diagrams programmatically. Enable it from the settings menu, then point your AI client at `http://127.0.0.1:21420/mcp`.

See the [MCP documentation](https://ipcrm.github.io/napkin/#mcp-overview) for setup instructions and the full tool reference.

## Contributing

Want to build from source or contribute? See the [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](LICENSE)
