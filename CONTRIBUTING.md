# Contributing to Forage

## Development Setup

1. Clone the repo
2. Install dependencies: `pnpm install`
3. Build all packages: `pnpm build`
4. Run tests: `pnpm test`

## Project Structure

This is a pnpm monorepo with three packages:

- **`packages/shared`** — Types and constants shared between plugin and server
- **`packages/plugin`** — Figma plugin (main thread + UI iframe WebSocket bridge)
- **`packages/mcp-server`** — MCP server (Node.js, stdio transport, WebSocket server)

## Making Changes

### Adding a New Tool

1. Add the command handler in `packages/plugin/src/code.ts` (in the `dispatch` switch and as a handler function)
2. Register the tool in `packages/mcp-server/src/index.ts` using `server.registerTool()`
3. Add the tool name to the expected tools list in `packages/mcp-server/src/__tests__/tools.test.ts`
4. Run `pnpm build && pnpm test` to verify

### Tool Guidelines

- All tools use the `forage_` prefix
- Use `snake_case` for tool names
- Every tool must have a comprehensive description with Args, Returns, and usage guidance
- Read-only tools must have `annotations: { readOnlyHint: true, destructiveHint: false }`
- Use Zod schemas for input validation

## Testing

```bash
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
```

## Build Verification

After any change, verify:

```bash
pnpm build   # Zero errors
pnpm test    # All passing
```
