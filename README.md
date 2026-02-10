# Forage

**Gather exactly what you need from your designs.**

Forage is a Figma plugin + MCP server that lets an LLM explore entire Figma files in a structured way — drilling down, comparing variants, reusing components, and extracting design tokens without flooding context.

## Why Forage?

Existing Figma MCPs dump 50K+ tokens in one shot. Forage gives the LLM **progressive navigation**: start with pages, drill into frames, inspect individual nodes, compare variants, infer state machines — each step returning only what's needed.

### Plugin API Advantages

Forage uses the Figma Plugin API (not the REST API), which means:

- **Zero rate limits** (REST API: 30 req/min max)
- **Variables accessible on all plans** (REST API: Enterprise-only)
- **Full prototype reactions** with triggers, actions, and destinations
- **Built-in CSS generation** via `node.getCSSAsync()`
- **Custom persistent annotations** via `setSharedPluginData()`
- **Real-time selection tracking**
- **In-memory speed** (milliseconds vs network round-trips)

## Architecture

```
Claude Code / Cursor / IDE  (MCP Client)
        ↕ stdio (MCP Protocol)
forage-mcp  (Node.js MCP Server)
        ↕ WebSocket (ws://localhost:18412)
Forage for Figma  (Plugin: hidden UI iframe ↔ main thread)
        ↕ Figma Plugin API
Figma Document
```

The three-tier bridge is dictated by Figma's plugin sandbox model:

1. **Plugin main thread** — full document access via Plugin API, no network
2. **Plugin UI iframe** — network access (WebSocket), no document access
3. **MCP server** — runs locally, connects via WebSocket, exposes tools via stdio

## Quick Start

### 1. Install the MCP Server

Add to your Claude Code config (`~/.claude/claude_code_config.json`):

```json
{
  "mcpServers": {
    "forage": {
      "command": "npx",
      "args": ["-y", "forage-mcp"]
    }
  }
}
```

Or for Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "forage": {
      "command": "npx",
      "args": ["-y", "forage-mcp"]
    }
  }
}
```

### 2. Install the Figma Plugin

1. Open Figma
2. Go to **Plugins > Development > Import plugin from manifest...**
3. Select `packages/plugin/manifest.json`
4. Run the plugin — it will connect to the MCP server automatically

### 3. Start Using

Open a Figma file, run the plugin, then ask your LLM:

> "Look at the Figma file and tell me what pages are available"

The LLM will use `forage_list_pages` to explore, then progressively drill down using the other tools.

## Tool Reference

### Tier 1: Discovery

| Tool | Description |
|------|-------------|
| `forage_list_pages` | List all pages with child counts |
| `forage_list_frames` | List top-level frames in a page |
| `forage_get_selection` | Get what the user has selected |

### Tier 2: Navigation

| Tool | Description |
|------|-------------|
| `forage_get_children` | Direct children of any node (with depth control) |
| `forage_get_variants` | List all variants of a component set |
| `forage_search_nodes` | Search by name, type, or style |

### Tier 3: Detail

| Tool | Description |
|------|-------------|
| `forage_get_node_detail` | Full layout, styles, variables — everything for implementation |
| `forage_get_css` | Figma's own CSS output |
| `forage_get_images` | Export as PNG or SVG (base64) |

### Tier 4: Design System

| Tool | Description |
|------|-------------|
| `forage_get_design_tokens` | Tokens as Tailwind config, CSS custom properties, or JSON |
| `forage_get_variables` | Raw variables with mode support (light/dark) |
| `forage_get_styles` | Paint, text, and effect styles |

### Tier 5: Intelligence

| Tool | Description |
|------|-------------|
| `forage_compare_variants` | Diff two variants — returns ONLY what changed |
| `forage_find_reusable` | Components used more than once (build these first) |
| `forage_find_similar` | Find structurally similar components |
| `forage_infer_states` | Suggest state machines from variants + reactions + annotations |
| `forage_lint_naming` | Flag generic names like "Frame 47" |

### Tier 6: Annotations

| Tool | Description |
|------|-------------|
| `forage_get_annotations` | Read designer state rules from a node |
| `forage_annotate_state` | Write state rules to a node (persists in file) |

## Design Token Formats

`forage_get_design_tokens` supports three output formats:

**Tailwind** (`format: "tailwind"`):
```js
{ theme: { colors: { primary: { 500: '#3366FF' } }, fontSize: { ... } } }
```

**CSS Custom Properties** (`format: "css"`):
```css
:root { --color-primary-500: #3366FF; --font-heading-lg: 700 32px/40px 'Inter'; }
```

**JSON** (`format: "json"`): Raw structured data (framework-agnostic)

## State Inference

`forage_infer_states` combines three data sources:

1. **Variant naming patterns** — "Default", "Hover", "Active", "Disabled" → interaction state machine
2. **Prototype reactions** — triggers and actions → transition graph
3. **Designer annotations** — explicit rules via `forage_annotate_state`

Output includes: states, transitions, confidence score, open questions, and a suggested React state management approach.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Monorepo Structure

```
forage/
├── packages/
│   ├── shared/      — @forage/shared (types + constants)
│   ├── plugin/      — @forage/plugin (Figma plugin)
│   └── mcp-server/  — forage-mcp (MCP server)
├── skill/           — SKILL.md companion guide
└── examples/        — Client config examples
```

## License

MIT
