import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PluginBridge } from "./bridge.js";

const bridge = new PluginBridge();

const server = new McpServer({
  name: "forage-mcp",
  version: "0.1.0",
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callPlugin(
  method: string,
  params?: Record<string, unknown>,
): Promise<string> {
  const result = await bridge.send(method, params);
  return JSON.stringify(result, null, 2);
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

async function safeCall(method: string, params?: Record<string, unknown>) {
  try {
    return textResult(await callPlugin(method, params));
  } catch (e: unknown) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}

// ── Annotations ───────────────────────────────────────────────────────────────

const readOnly = { readOnlyHint: true, destructiveHint: false } as const;
const writeable = { readOnlyHint: false, destructiveHint: false } as const;

// ── Tier 1: Discovery ─────────────────────────────────────────────────────────

server.registerTool("forage_list_pages", {
  description: `List all pages in the current Figma file with their names and child counts.

Args: none
Returns: Array of { id, name, childCount }

Use this as the starting point to explore a Figma file. Call this first, then use forage_list_frames to drill into a specific page.
Do NOT use this if you already know the page ID you need.`,
  annotations: readOnly,
}, async () => safeCall("getPages"));

server.registerTool("forage_list_frames", {
  description: `List all top-level frames in a specific Figma page.

Args:
  pageId (required): The page ID to list frames from (get this from forage_list_pages)
Returns: Array of simplified frame objects with { id, name, type, childCount, ... }

Use this after forage_list_pages to see the top-level structure of a page. Then use forage_get_children to drill deeper.
Do NOT use this to get nested children — use forage_get_children instead.`,
  inputSchema: { pageId: z.string().describe("The page ID (from forage_list_pages)") },
  annotations: readOnly,
}, async ({ pageId }) => safeCall("getFrames", { pageId }));

server.registerTool("forage_get_selection", {
  description: `Get the currently selected nodes in Figma.

Args: none
Returns: { selection: SimplifiedNode[], pageId, pageName } or empty selection message

Use this when the user says "look at what I have selected" or wants you to work with their current selection.
Do NOT use this for general exploration — start with forage_list_pages instead.`,
  annotations: readOnly,
}, async () => safeCall("getSelection"));

// ── Tier 2: Navigation ────────────────────────────────────────────────────────

server.registerTool("forage_get_children", {
  description: `Get the direct children of any node, with optional depth control.

Args:
  nodeId (required): The node ID to get children of
  depth (optional, default 1): How many levels deep to recurse (1 = direct children only, 2 = children + grandchildren, etc.)
Returns: { id, name, type, children: SimplifiedNode[] }

Use this to progressively drill into the node tree. Start with depth=1 and go deeper only if needed.
Do NOT request depth > 3 unless you specifically need deep nesting — it increases token usage significantly.`,
  inputSchema: {
    nodeId: z.string().describe("The node ID to get children of"),
    depth: z.number().min(1).max(10).optional().describe("Recursion depth (default: 1, max: 10)"),
  },
  annotations: readOnly,
}, async ({ nodeId, depth }) => safeCall("getChildren", { nodeId, depth }));

server.registerTool("forage_get_variants", {
  description: `List all variants of a component set with their property definitions and values.

Args:
  nodeId (required): The component set node ID
Returns: { id, name, properties (definitions), variants: [{ id, name, properties }] }

Use this on a COMPONENT_SET node to see all its variants and their property combinations.
Do NOT use this on individual components or instances — it only works on component sets.`,
  inputSchema: { nodeId: z.string().describe("The component set node ID") },
  annotations: readOnly,
}, async ({ nodeId }) => safeCall("getVariants", { nodeId }));

server.registerTool("forage_search_nodes", {
  description: `Search for nodes by name, type, or both across the current page or a specific page.

Args:
  query (optional): Text to search for in node names (case-insensitive)
  type (optional): Figma node type to filter by (e.g., "FRAME", "COMPONENT", "TEXT", "INSTANCE")
  pageId (optional): Specific page ID to search in (defaults to current page)
Returns: { results: SimplifiedNode[], total, capped (true if results exceed 100) }

Use this to find specific elements by name or type. Results are capped at 100 to prevent context flooding.
Do NOT use this for general exploration — use forage_list_pages → forage_list_frames → forage_get_children instead.`,
  inputSchema: {
    query: z.string().optional().describe("Search text (matches node names, case-insensitive)"),
    type: z.string().optional().describe("Figma node type filter (FRAME, COMPONENT, TEXT, INSTANCE, etc.)"),
    pageId: z.string().optional().describe("Page ID to search in (defaults to current page)"),
  },
  annotations: readOnly,
}, async ({ query, type, pageId }) => safeCall("searchNodes", { query, type, pageId }));

// ── Tier 3: Detail ────────────────────────────────────────────────────────────

server.registerTool("forage_get_node_detail", {
  description: `Get comprehensive implementation-ready details for a specific node: layout, styles, fills, strokes, effects, bound variables, component properties, prototype reactions, and optionally CSS.

Args:
  nodeId (required): The node ID to inspect
  includeCss (optional, default false): Also include Figma's CSS output
Returns: Full simplified node with all available properties

Use this when you need to implement a specific component or element. This is the richest inspection tool.
Do NOT use this for browsing — use forage_get_children for tree navigation.`,
  inputSchema: {
    nodeId: z.string().describe("The node ID to inspect"),
    includeCss: z.boolean().optional().describe("Include Figma CSS output (default: false)"),
  },
  annotations: readOnly,
}, async ({ nodeId, includeCss }) => safeCall("getNodeDetail", { nodeId, includeCss }));

server.registerTool("forage_get_css", {
  description: `Get Figma's own CSS output for a node via getCSSAsync().

Args:
  nodeId (required): The node ID to get CSS for
Returns: { nodeId, css: Record<string, string> }

Use this when you need CSS properties for implementation. Figma generates the CSS from the node's visual properties.
Do NOT use this on container/group nodes — it works best on leaf nodes with visual styling.`,
  inputSchema: { nodeId: z.string().describe("The node ID to get CSS for") },
  annotations: readOnly,
}, async ({ nodeId }) => safeCall("getCss", { nodeId }));

server.registerTool("forage_get_images", {
  description: `Export a node as an image (PNG, SVG, JPG, or PDF) encoded in base64.

Args:
  nodeId (required): The node ID to export
  format (optional, default "PNG"): Export format — "PNG", "SVG", "JPG", or "PDF"
  scale (optional, default 2): Export scale (1x, 2x, 3x, etc.) — only applies to raster formats
Returns: { nodeId, format, mimeType, data (base64), size (bytes) }

Use this to get visual assets for implementation. SVG for icons/illustrations, PNG for photos/complex graphics.
Do NOT request large nodes at high scale — it can produce very large base64 strings.`,
  inputSchema: {
    nodeId: z.string().describe("The node ID to export"),
    format: z.enum(["PNG", "SVG", "JPG", "PDF"]).optional().describe("Export format (default: PNG)"),
    scale: z.number().min(0.5).max(4).optional().describe("Export scale for raster formats (default: 2)"),
  },
  annotations: readOnly,
}, async ({ nodeId, format, scale }) => safeCall("getImages", { nodeId, format, scale }));

// ── Tier 4: Design System ─────────────────────────────────────────────────────

server.registerTool("forage_get_design_tokens", {
  description: `Extract all design tokens (colors, spacing, typography) formatted as Tailwind config, CSS custom properties, or raw JSON.

Args:
  format (optional, default "json"): Output format — "tailwind", "css", or "json"
Returns:
  - tailwind: { format: "tailwind", theme: { colors, fontSize } }
  - css: { format: "css", css: ":root { --var: value; ... }" }
  - json: Raw structured token data with colors, spacing, typography

Use this to get a complete design system snapshot for code generation. Choose the format matching your target framework.
Do NOT call this repeatedly — cache the result. The tokens don't change during a session unless the designer modifies them.`,
  inputSchema: {
    format: z.enum(["tailwind", "css", "json"]).optional().describe("Output format (default: json)"),
  },
  annotations: readOnly,
}, async ({ format }) => safeCall("getDesignTokens", { format }));

server.registerTool("forage_get_variables", {
  description: `Get all local Figma variables with their values across all modes (e.g., light/dark theme).

Args: none
Returns: Array of { id, name, resolvedType, valuesByMode: { modeName: value }, scopes, collectionName }

Use this to understand the variable system — colors, spacing, and other tokens with mode support.
Do NOT use this if you just need formatted tokens — use forage_get_design_tokens instead.`,
  annotations: readOnly,
}, async () => safeCall("getVariables"));

server.registerTool("forage_get_styles", {
  description: `Get all local paint, text, and effect styles defined in the Figma file.

Args: none
Returns: { paintStyles: [...], textStyles: [...], effectStyles: [...] }

Use this to understand the style system. Each style includes its visual properties.
Do NOT use this if you need variables/tokens — use forage_get_variables or forage_get_design_tokens instead.`,
  annotations: readOnly,
}, async () => safeCall("getStyles"));

// ── Tier 5: Intelligence ──────────────────────────────────────────────────────

server.registerTool("forage_compare_variants", {
  description: `Compare two variant nodes and return ONLY the properties that differ between them.

Args:
  nodeIdA (required): First variant node ID
  nodeIdB (required): Second variant node ID
Returns: { nodeA, nodeB, differences: { property: { a: valueA, b: valueB } }, differenceCount }

Use this to understand what changes between states/variants (e.g., Default vs Hover).
Do NOT use this on unrelated nodes — it's designed for comparing variants of the same component.`,
  inputSchema: {
    nodeIdA: z.string().describe("First variant node ID"),
    nodeIdB: z.string().describe("Second variant node ID"),
  },
  annotations: readOnly,
}, async ({ nodeIdA, nodeIdB }) => safeCall("compareVariants", { nodeIdA, nodeIdB }));

server.registerTool("forage_find_reusable", {
  description: `Find components that are used more than once on the current page (build these first).

Args: none
Returns: { reusableComponents: [{ component: { id, name }, count, instanceIds }], total }

Use this to identify which components to implement first — the most reused components give the biggest ROI.
Do NOT use this to find all components — use forage_search_nodes with type "COMPONENT" instead.`,
  annotations: readOnly,
}, async () => safeCall("findReusable"));

server.registerTool("forage_find_similar", {
  description: `Find nodes structurally similar to a given node on the current page.

Args:
  nodeId (required): The reference node ID to find similar nodes to
  threshold (optional, default 0.7): Similarity threshold (0.0 to 1.0)
Returns: { target, similar: [{ node, similarity }], total }

Use this to find candidates for component extraction — similar nodes that could share a component.
Do NOT use this on very common node types (like TEXT) without a high threshold — it will return too many results.`,
  inputSchema: {
    nodeId: z.string().describe("The reference node ID"),
    threshold: z.number().min(0).max(1).optional().describe("Similarity threshold 0-1 (default: 0.7)"),
  },
  annotations: readOnly,
}, async ({ nodeId, threshold }) => safeCall("findSimilar", { nodeId, threshold }));

server.registerTool("forage_infer_states", {
  description: `Infer a state machine from a component by analyzing variant names, prototype reactions, and designer annotations.

Args:
  nodeId (required): The node ID (ideally a COMPONENT_SET) to analyze
Returns: { states, transitions, confidence (0-1), sources, openQuestions, suggestedImplementation }

Use this on component sets with variants like Default/Hover/Active/Disabled to get a state machine suggestion.
Do NOT use this on leaf nodes — it works best on component sets and nodes with prototype reactions.`,
  inputSchema: { nodeId: z.string().describe("The node ID to analyze (ideally a COMPONENT_SET)") },
  annotations: readOnly,
}, async ({ nodeId }) => safeCall("inferStates", { nodeId }));

server.registerTool("forage_lint_naming", {
  description: `Check for generic/default naming issues across a page. Flags names like "Frame 47", "Group 12", etc.

Args:
  pageId (optional): Page ID to lint (defaults to current page)
Returns: { issues: [{ nodeId, name, type, issue, suggestion }], issueCount, totalNodes }

Use this to identify naming quality issues before implementation — well-named layers make better code.
Do NOT run this on pages with hundreds of nodes unless you're ready for a large result set.`,
  inputSchema: {
    pageId: z.string().optional().describe("Page ID to lint (defaults to current page)"),
  },
  annotations: readOnly,
}, async ({ pageId }) => safeCall("lintNaming", { pageId }));

// ── Tier 6: Annotations ──────────────────────────────────────────────────────

server.registerTool("forage_get_annotations", {
  description: `Read state rules and designer notes from a node (stored via setSharedPluginData).

Args:
  nodeId (required): The node ID to read annotations from
Returns: { nodeId, nodeName, annotations (parsed JSON or null) }

Use this to check for designer-provided state rules before inferring them automatically.
Do NOT use this on every node — only check annotations on components and interactive elements.`,
  inputSchema: { nodeId: z.string().describe("The node ID to read annotations from") },
  annotations: readOnly,
}, async ({ nodeId }) => safeCall("getAnnotations", { nodeId }));

server.registerTool("forage_annotate_state", {
  description: `Write state rules to a node. These persist in the Figma file and are used by forage_infer_states.

Args:
  nodeId (required): The node ID to annotate
  annotation (required): JSON string with { states: string[], transitions: [{ from, to, trigger }], notes?: string }
Returns: Confirmation with the saved annotation

Use this to save explicit state rules that forage_infer_states will incorporate.
Do NOT overwrite existing annotations without reading them first with forage_get_annotations.`,
  inputSchema: {
    nodeId: z.string().describe("The node ID to annotate"),
    annotation: z.string().describe('JSON string: { states: ["Default","Hover",...], transitions: [{ from, to, trigger }], notes?: "..." }'),
  },
  annotations: writeable,
}, async ({ nodeId, annotation }) => safeCall("annotateState", { nodeId, annotation }));

// ── Start Server ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[forage] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[forage] Fatal error:", err);
  process.exit(1);
});
