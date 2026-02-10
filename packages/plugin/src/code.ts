// Forage for Figma — Plugin Main Thread
// Has full access to the Figma Plugin API. No network access.
// Communicates with the UI iframe via figma.ui.postMessage / figma.ui.onmessage.

import type { ForageCommand, ForageResponse, SimplifiedPage } from "@forage/shared";

// Show the UI iframe (hidden — it only serves as a WebSocket bridge)
figma.showUI(__html__, { visible: true, width: 200, height: 36 });

// ── Command Dispatcher ────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: ForageCommand) => {
  const { id, method, params } = msg;

  try {
    const result = await dispatch(method, params);
    const response: ForageResponse = { id, type: "response", result };
    figma.ui.postMessage(response);
  } catch (error: unknown) {
    const response: ForageResponse = {
      id,
      type: "response",
      error: {
        code: (error as { code?: string }).code ?? "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
    figma.ui.postMessage(response);
  }
};

async function dispatch(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  switch (method) {
    case "getPages":
      return handleGetPages();
    case "getFrames":
      return handleGetFrames(params as { pageId: string });
    case "getSelection":
      return handleGetSelection();
    case "getChildren":
      return handleGetChildren(params as { nodeId: string; depth?: number });
    case "getVariants":
      return handleGetVariants(params as { nodeId: string });
    case "searchNodes":
      return handleSearchNodes(
        params as { query?: string; type?: string; pageId?: string },
      );
    case "getNodeDetail":
      return handleGetNodeDetail(
        params as { nodeId: string; includeCss?: boolean },
      );
    case "getCss":
      return handleGetCss(params as { nodeId: string });
    case "getImages":
      return handleGetImages(
        params as { nodeId: string; format?: string; scale?: number },
      );
    case "getDesignTokens":
      return handleGetDesignTokens(params as { format?: string });
    case "getVariables":
      return handleGetVariables();
    case "getStyles":
      return handleGetStyles();
    case "compareVariants":
      return handleCompareVariants(
        params as { nodeIdA: string; nodeIdB: string },
      );
    case "findReusable":
      return handleFindReusable();
    case "findSimilar":
      return handleFindSimilar(params as { nodeId: string; threshold?: number });
    case "inferStates":
      return handleInferStates(params as { nodeId: string });
    case "lintNaming":
      return handleLintNaming(params as { pageId?: string });
    case "getAnnotations":
      return handleGetAnnotations(params as { nodeId: string });
    case "annotateState":
      return handleAnnotateState(
        params as { nodeId: string; annotation: string },
      );
    default:
      throw { code: "UNKNOWN_METHOD", message: `Unknown method: ${method}` };
  }
}

// ── Node Simplifier ───────────────────────────────────────────────────────────

function simplifyNode(node: SceneNode, includeChildren = false): Record<string, unknown> {
  const simplified: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if (!node.visible) simplified.visible = false;

  // Size
  if ("width" in node) simplified.width = Math.round(node.width);
  if ("height" in node) simplified.height = Math.round(node.height);

  // Children count
  if ("children" in node) {
    const parent = node as ChildrenMixin & SceneNode;
    simplified.childCount = parent.children.length;

    if (includeChildren) {
      simplified.children = parent.children.map((c) => simplifyNode(c));
    }
  }

  // Auto-layout
  if ("layoutMode" in node) {
    const frame = node as FrameNode;
    if (frame.layoutMode !== "NONE") {
      simplified.layoutMode = frame.layoutMode;
      simplified.primaryAxisAlignItems = frame.primaryAxisAlignItems;
      simplified.counterAxisAlignItems = frame.counterAxisAlignItems;
      simplified.paddingLeft = frame.paddingLeft;
      simplified.paddingRight = frame.paddingRight;
      simplified.paddingTop = frame.paddingTop;
      simplified.paddingBottom = frame.paddingBottom;
      simplified.itemSpacing = frame.itemSpacing;
      if (frame.counterAxisSpacing !== undefined && frame.counterAxisSpacing !== null) {
        simplified.counterAxisSpacing = frame.counterAxisSpacing;
      }
    }
  }

  // Layout child properties
  if ("layoutAlign" in node) {
    const child = node as SceneNode & { layoutAlign: string; layoutGrow: number };
    if (child.layoutAlign !== "INHERIT") simplified.layoutAlign = child.layoutAlign;
    if (child.layoutGrow !== 0) simplified.layoutGrow = child.layoutGrow;
  }

  // Component info
  if (node.type === "COMPONENT") {
    simplified.isComponent = true;
  }
  if (node.type === "COMPONENT_SET") {
    simplified.isComponentSet = true;
  }
  if (node.type === "INSTANCE") {
    simplified.isInstance = true;
    simplified.mainComponentId = (node as InstanceNode).mainComponent?.id;
  }

  // Variant properties
  if ("variantProperties" in node && (node as InstanceNode).variantProperties) {
    simplified.variantProperties = (node as InstanceNode).variantProperties;
  }

  // Component properties (for component sets)
  if ("componentPropertyDefinitions" in node) {
    const defs = (node as ComponentSetNode).componentPropertyDefinitions;
    if (defs && Object.keys(defs).length > 0) {
      simplified.componentProperties = defs;
    }
  }

  // Fills (simplified)
  if ("fills" in node && Array.isArray(node.fills)) {
    const visible = (node.fills as readonly Paint[]).filter((f) => f.visible !== false);
    if (visible.length > 0) simplified.fills = visible.map(simplifyPaint);
  }

  // Strokes
  if ("strokes" in node && Array.isArray(node.strokes)) {
    const visible = (node.strokes as readonly Paint[]).filter((f) => f.visible !== false);
    if (visible.length > 0) simplified.strokes = visible.map(simplifyPaint);
  }

  // Effects
  if ("effects" in node && Array.isArray(node.effects)) {
    const visible = (node.effects as readonly Effect[]).filter((e) => e.visible !== false);
    if (visible.length > 0) simplified.effects = visible.map(simplifyEffect);
  }

  // Opacity
  if ("opacity" in node && (node as BlendMixin).opacity !== 1) {
    simplified.opacity = (node as BlendMixin).opacity;
  }

  // Corner radius
  if ("cornerRadius" in node) {
    const r = (node as RectangleNode);
    if (typeof r.cornerRadius === "number" && r.cornerRadius > 0) {
      simplified.cornerRadius = r.cornerRadius;
    } else if (r.cornerRadius === figma.mixed) {
      simplified.borderRadius = `${r.topLeftRadius} ${r.topRightRadius} ${r.bottomRightRadius} ${r.bottomLeftRadius}`;
    }
  }

  // Text
  if (node.type === "TEXT") {
    const text = node as TextNode;
    simplified.textContent = text.characters;
    if (typeof text.fontSize === "number") simplified.fontSize = text.fontSize;
    if (text.fontName !== figma.mixed) simplified.fontName = text.fontName;
    if (typeof text.fontWeight === "number") simplified.fontWeight = text.fontWeight;
    if (text.lineHeight !== figma.mixed) simplified.lineHeight = text.lineHeight;
    if (text.letterSpacing !== figma.mixed) simplified.letterSpacing = text.letterSpacing;
    simplified.textAlignHorizontal = text.textAlignHorizontal;
    simplified.textAlignVertical = text.textAlignVertical;
  }

  return simplified;
}

function simplifyPaint(paint: Paint): Record<string, unknown> {
  const p: Record<string, unknown> = { type: paint.type };
  if (paint.type === "SOLID") {
    const solid = paint as SolidPaint;
    p.color = rgbToHex(solid.color);
    if (solid.opacity !== undefined && solid.opacity !== 1) p.opacity = solid.opacity;
  }
  if (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL") {
    const grad = paint as GradientPaint;
    p.gradientStops = grad.gradientStops.map((s) => ({
      color: rgbToHex(s.color),
      position: s.position,
    }));
  }
  return p;
}

function simplifyEffect(effect: Effect): Record<string, unknown> {
  const e: Record<string, unknown> = { type: effect.type };
  if ("radius" in effect) e.radius = (effect as BlurEffect).radius;
  if ("offset" in effect) {
    const shadow = effect as DropShadowEffect;
    e.offset = shadow.offset;
    e.color = rgbToHex(shadow.color);
  }
  if ("spread" in effect) e.spread = (effect as DropShadowEffect).spread;
  return e;
}

function rgbToHex(color: RGB | RGBA): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  if ("a" in color && color.a !== undefined && color.a < 1) {
    const a = Math.round(color.a * 255);
    return hex + a.toString(16).padStart(2, "0");
  }
  return hex;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findNodeById(nodeId: string): Promise<SceneNode> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
    throw { code: "NODE_NOT_FOUND", message: `Node not found: ${nodeId}` };
  }
  return node as SceneNode;
}

async function findPageById(pageId: string): Promise<PageNode> {
  const node = await figma.getNodeByIdAsync(pageId);
  if (!node || node.type !== "PAGE") {
    throw { code: "PAGE_NOT_FOUND", message: `Page not found: ${pageId}` };
  }
  return node as PageNode;
}

// ── Tier 1: Discovery ─────────────────────────────────────────────────────────

async function handleGetPages(): Promise<SimplifiedPage[]> {
  await figma.loadAllPagesAsync();
  return figma.root.children.map((page) => ({
    id: page.id,
    name: page.name,
    childCount: page.children.length,
  }));
}

async function handleGetFrames(params: { pageId: string }) {
  const page = await findPageById(params.pageId);
  await page.loadAsync();
  return page.children.map((child) => simplifyNode(child));
}

function handleGetSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    return { selection: [], message: "Nothing is selected in Figma" };
  }
  return {
    selection: selection.map((node) => simplifyNode(node)),
    pageId: figma.currentPage.id,
    pageName: figma.currentPage.name,
  };
}

// ── Tier 2: Navigation ────────────────────────────────────────────────────────

async function handleGetChildren(params: { nodeId: string; depth?: number }) {
  const node = await findNodeById(params.nodeId);
  if (!("children" in node)) {
    return { id: node.id, name: node.name, type: node.type, children: [] };
  }

  const depth = params.depth ?? 1;
  const parent = node as ChildrenMixin & SceneNode;

  function getChildrenAtDepth(n: SceneNode, d: number): Record<string, unknown> {
    const simplified = simplifyNode(n);
    if (d > 0 && "children" in n) {
      const ch = n as ChildrenMixin & SceneNode;
      simplified.children = ch.children.map((c) => getChildrenAtDepth(c, d - 1));
    }
    return simplified;
  }

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    children: parent.children.map((c) => getChildrenAtDepth(c, depth - 1)),
  };
}

async function handleGetVariants(params: { nodeId: string }) {
  const node = await findNodeById(params.nodeId);

  if (node.type !== "COMPONENT_SET") {
    throw {
      code: "NOT_COMPONENT_SET",
      message: `Node ${params.nodeId} is a ${node.type}, not a COMPONENT_SET. Use this tool on a component set to list its variants.`,
    };
  }

  const componentSet = node as ComponentSetNode;
  const propertyDefs = componentSet.componentPropertyDefinitions;

  return {
    id: componentSet.id,
    name: componentSet.name,
    properties: propertyDefs,
    variants: componentSet.children.map((variant) => ({
      id: variant.id,
      name: variant.name,
      properties: variant.type === "COMPONENT"
        ? Object.fromEntries(
            variant.name.split(", ").map((pair) => {
              const [key, ...rest] = pair.split("=");
              return [key, rest.join("=")];
            }),
          )
        : undefined,
    })),
  };
}

async function handleSearchNodes(params: {
  query?: string;
  type?: string;
  pageId?: string;
}) {
  const page = params.pageId
    ? await findPageById(params.pageId)
    : figma.currentPage;
  await page.loadAsync();

  let results: SceneNode[];

  if (params.type) {
    results = page.findAllWithCriteria({
      types: [params.type as NodeType],
    });
  } else {
    results = page.findAll(() => true);
  }

  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter((n) => n.name.toLowerCase().includes(q));
  }

  // Cap results to prevent flooding context
  const capped = results.slice(0, 100);

  return {
    results: capped.map((n) => simplifyNode(n)),
    total: results.length,
    capped: results.length > 100,
  };
}

// ── Tier 3: Detail ────────────────────────────────────────────────────────────

async function handleGetNodeDetail(params: {
  nodeId: string;
  includeCss?: boolean;
}) {
  const node = await findNodeById(params.nodeId);
  const detail = simplifyNode(node, true);

  // Add bound variables if available
  if ("boundVariables" in node) {
    const bv = (node as SceneNode & { boundVariables: Record<string, unknown> }).boundVariables;
    if (bv && Object.keys(bv).length > 0) {
      detail.boundVariables = bv;
    }
  }

  // Add reactions (prototype interactions)
  if ("reactions" in node) {
    const reactions = (node as SceneNode & { reactions: readonly Reaction[] }).reactions;
    if (reactions && reactions.length > 0) {
      detail.reactions = reactions.map((r) => ({
        trigger: r.trigger?.type,
        actions: r.actions?.map((a) => ({
          type: a.type,
          navigation: "navigation" in a ? a.navigation : undefined,
          destinationId: "destinationId" in a ? a.destinationId : undefined,
        })),
      }));
    }
  }

  // Optionally include CSS
  if (params.includeCss && "getCSSAsync" in node) {
    try {
      detail.css = await (node as SceneNode & { getCSSAsync: () => Promise<Record<string, string>> }).getCSSAsync();
    } catch {
      // getCSSAsync may not be available for all node types
    }
  }

  return detail;
}

async function handleGetCss(params: { nodeId: string }) {
  const node = await findNodeById(params.nodeId);
  if (!("getCSSAsync" in node)) {
    throw {
      code: "CSS_NOT_SUPPORTED",
      message: `CSS generation is not supported for ${node.type} nodes`,
    };
  }
  const css = await (node as SceneNode & { getCSSAsync: () => Promise<Record<string, string>> }).getCSSAsync();
  return { nodeId: params.nodeId, css };
}

async function handleGetImages(params: {
  nodeId: string;
  format?: string;
  scale?: number;
}) {
  const node = await findNodeById(params.nodeId);
  const format = (params.format ?? "PNG") as "PNG" | "SVG" | "PDF" | "JPG";
  const scale = params.scale ?? 2;

  if (!("exportAsync" in node)) {
    throw {
      code: "EXPORT_NOT_SUPPORTED",
      message: `Export is not supported for ${node.type} nodes`,
    };
  }

  const settings: ExportSettings =
    format === "SVG"
      ? { format: "SVG" }
      : { format: format as "PNG" | "JPG" | "PDF", constraint: { type: "SCALE", value: scale } };

  const bytes = await (node as SceneNode & { exportAsync: (settings: ExportSettings) => Promise<Uint8Array> }).exportAsync(settings);
  const base64 = figma.base64Encode(bytes);
  const mimeType =
    format === "SVG"
      ? "image/svg+xml"
      : format === "PNG"
        ? "image/png"
        : format === "JPG"
          ? "image/jpeg"
          : "application/pdf";

  return {
    nodeId: params.nodeId,
    format,
    mimeType,
    data: base64,
    size: bytes.length,
  };
}

// ── Tier 4: Design System ─────────────────────────────────────────────────────

async function handleGetDesignTokens(params: { format?: string }) {
  const format = params.format ?? "json";

  const [variables, paintStyles, textStyles, effectStyles] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
  ]);

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  // Build structured token data
  const colors: Record<string, unknown> = {};
  const spacing: Record<string, unknown> = {};
  const typography: Record<string, unknown> = {};
  const other: Record<string, unknown> = {};

  for (const v of variables) {
    const collection = collectionMap.get(v.variableCollectionId);
    const modes = collection?.modes ?? [];
    const values: Record<string, unknown> = {};
    for (const mode of modes) {
      values[mode.name] = v.valuesByMode[mode.modeId];
    }

    const token = {
      name: v.name,
      type: v.resolvedType,
      values,
      scopes: v.scopes,
    };

    switch (v.resolvedType) {
      case "COLOR":
        colors[v.name] = token;
        break;
      case "FLOAT":
        spacing[v.name] = token;
        break;
      default:
        other[v.name] = token;
    }
  }

  for (const style of textStyles) {
    typography[style.name] = {
      name: style.name,
      fontSize: style.fontSize,
      fontFamily: style.fontName.family,
      fontWeight: style.fontName.style,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
    };
  }

  const raw = { colors, spacing, typography, paintStyles: paintStyles.length, effectStyles: effectStyles.length, other };

  if (format === "tailwind") return formatTailwind(raw, variables, textStyles);
  if (format === "css") return formatCss(raw, variables, textStyles);
  return raw;
}

function formatTailwind(
  raw: Record<string, unknown>,
  variables: Variable[],
  textStyles: TextStyle[],
): Record<string, unknown> {
  const colors: Record<string, string> = {};
  for (const v of variables) {
    if (v.resolvedType === "COLOR") {
      const firstMode = Object.keys(v.valuesByMode)[0];
      const val = v.valuesByMode[firstMode];
      if (val && typeof val === "object" && "r" in val) {
        colors[v.name.replace(/\//g, "-")] = rgbToHex(val as RGB);
      }
    }
  }

  const fontSize: Record<string, unknown> = {};
  for (const style of textStyles) {
    const lh = style.lineHeight;
    const lineHeight =
      lh.unit === "PIXELS"
        ? `${lh.value}px`
        : lh.unit === "PERCENT"
          ? `${lh.value}%`
          : "normal";
    fontSize[style.name.replace(/\//g, "-")] = [
      `${style.fontSize}px`,
      { lineHeight, fontWeight: style.fontName.style },
    ];
  }

  return {
    format: "tailwind",
    theme: { colors, fontSize },
  };
}

function formatCss(
  raw: Record<string, unknown>,
  variables: Variable[],
  textStyles: TextStyle[],
): Record<string, unknown> {
  const properties: string[] = [];

  for (const v of variables) {
    if (v.resolvedType === "COLOR") {
      const firstMode = Object.keys(v.valuesByMode)[0];
      const val = v.valuesByMode[firstMode];
      if (val && typeof val === "object" && "r" in val) {
        properties.push(`  --${v.name.replace(/\//g, "-")}: ${rgbToHex(val as RGB)};`);
      }
    } else if (v.resolvedType === "FLOAT") {
      const firstMode = Object.keys(v.valuesByMode)[0];
      const val = v.valuesByMode[firstMode];
      if (typeof val === "number") {
        properties.push(`  --${v.name.replace(/\//g, "-")}: ${val}px;`);
      }
    }
  }

  for (const style of textStyles) {
    const lh = style.lineHeight;
    const lineHeight =
      lh.unit === "PIXELS"
        ? `${lh.value}px`
        : lh.unit === "PERCENT"
          ? `${lh.value}%`
          : "normal";
    properties.push(
      `  --font-${style.name.replace(/\//g, "-")}: ${style.fontName.style} ${style.fontSize}px/${lineHeight} '${style.fontName.family}';`,
    );
  }

  return {
    format: "css",
    css: `:root {\n${properties.join("\n")}\n}`,
  };
}

async function handleGetVariables() {
  const variables = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  return variables.map((v) => {
    const collection = collectionMap.get(v.variableCollectionId);
    const modes = collection?.modes ?? [];
    const valuesByMode: Record<string, unknown> = {};
    for (const mode of modes) {
      valuesByMode[mode.name] = v.valuesByMode[mode.modeId];
    }
    return {
      id: v.id,
      name: v.name,
      resolvedType: v.resolvedType,
      valuesByMode,
      scopes: v.scopes,
      collectionName: collection?.name,
    };
  });
}

async function handleGetStyles() {
  const [paintStyles, textStyles, effectStyles] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
  ]);

  return {
    paintStyles: paintStyles.map((s) => ({
      id: s.id,
      name: s.name,
      type: "PAINT",
      paints: (s.paints as readonly Paint[]).map(simplifyPaint),
    })),
    textStyles: textStyles.map((s) => ({
      id: s.id,
      name: s.name,
      type: "TEXT",
      fontSize: s.fontSize,
      fontFamily: s.fontName.family,
      fontWeight: s.fontName.style,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
    })),
    effectStyles: effectStyles.map((s) => ({
      id: s.id,
      name: s.name,
      type: "EFFECT",
      effects: (s.effects as readonly Effect[]).map(simplifyEffect),
    })),
  };
}

// ── Tier 5: Intelligence ──────────────────────────────────────────────────────

async function handleCompareVariants(params: {
  nodeIdA: string;
  nodeIdB: string;
}) {
  const [nodeA, nodeB] = await Promise.all([
    findNodeById(params.nodeIdA),
    findNodeById(params.nodeIdB),
  ]);

  const simplifiedA = simplifyNode(nodeA, true);
  const simplifiedB = simplifyNode(nodeB, true);

  const differences: Record<string, { a: unknown; b: unknown }> = {};
  const allKeys = new Set([
    ...Object.keys(simplifiedA),
    ...Object.keys(simplifiedB),
  ]);

  for (const key of allKeys) {
    const valA = simplifiedA[key];
    const valB = simplifiedB[key];
    if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      differences[key] = { a: valA, b: valB };
    }
  }

  return {
    nodeA: { id: nodeA.id, name: nodeA.name },
    nodeB: { id: nodeB.id, name: nodeB.name },
    differences,
    differenceCount: Object.keys(differences).length,
  };
}

async function handleFindReusable() {
  const page = figma.currentPage;
  await page.loadAsync();

  const instances = page.findAllWithCriteria({ types: ["INSTANCE"] }) as InstanceNode[];
  const componentUsage = new Map<string, { component: { id: string; name: string }; count: number; instanceIds: string[] }>();

  for (const instance of instances) {
    if (!instance.mainComponent) continue;
    const compId = instance.mainComponent.id;
    const existing = componentUsage.get(compId);
    if (existing) {
      existing.count++;
      existing.instanceIds.push(instance.id);
    } else {
      componentUsage.set(compId, {
        component: { id: compId, name: instance.mainComponent.name },
        count: 1,
        instanceIds: [instance.id],
      });
    }
  }

  // Only return components used more than once, sorted by usage
  const reusable = Array.from(componentUsage.values())
    .filter((c) => c.count > 1)
    .sort((a, b) => b.count - a.count);

  return {
    reusableComponents: reusable,
    total: reusable.length,
  };
}

async function handleFindSimilar(params: { nodeId: string; threshold?: number }) {
  const targetNode = await findNodeById(params.nodeId);
  const target = simplifyNode(targetNode);
  const page = figma.currentPage;
  await page.loadAsync();

  const candidates = page.findAll((n) => n.type === targetNode.type && n.id !== targetNode.id);

  const similar: Array<{ node: Record<string, unknown>; similarity: number }> = [];

  for (const candidate of candidates) {
    const simplified = simplifyNode(candidate);
    const similarity = computeSimilarity(target, simplified);
    if (similarity >= (params.threshold ?? 0.7)) {
      similar.push({ node: simplified, similarity: Math.round(similarity * 100) / 100 });
    }
  }

  similar.sort((a, b) => b.similarity - a.similarity);

  return {
    target: { id: targetNode.id, name: targetNode.name, type: targetNode.type },
    similar: similar.slice(0, 20),
    total: similar.length,
  };
}

function computeSimilarity(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const skip = new Set(["id", "name", "children"]);
  let matches = 0;
  let total = 0;

  for (const key of keys) {
    if (skip.has(key)) continue;
    total++;
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) {
      matches++;
    }
  }

  return total > 0 ? matches / total : 0;
}

async function handleInferStates(params: { nodeId: string }) {
  const node = await findNodeById(params.nodeId);
  const states: string[] = [];
  const transitions: Array<{ from: string; to: string; trigger: string; action?: string }> = [];
  const sources: string[] = [];
  const openQuestions: string[] = [];

  // Source 1: Variant naming patterns
  if (node.type === "COMPONENT_SET") {
    const componentSet = node as ComponentSetNode;
    sources.push("variant-names");

    for (const variant of componentSet.children) {
      if (variant.type === "COMPONENT") {
        const pairs = variant.name.split(", ");
        for (const pair of pairs) {
          const [, value] = pair.split("=");
          if (value) {
            const normalized = value.trim();
            if (!states.includes(normalized)) states.push(normalized);
          }
        }
      }
    }

    // Infer transitions from state names
    const interactionStates = ["Default", "Hover", "Active", "Pressed", "Focus", "Disabled"];
    const foundInteraction = states.filter((s) =>
      interactionStates.some((is) => s.toLowerCase() === is.toLowerCase()),
    );

    if (foundInteraction.length > 1) {
      if (foundInteraction.find((s) => s.toLowerCase() === "default") && foundInteraction.find((s) => s.toLowerCase() === "hover")) {
        transitions.push({ from: "Default", to: "Hover", trigger: "ON_HOVER" });
        transitions.push({ from: "Hover", to: "Default", trigger: "MOUSE_LEAVE" });
      }
      if (foundInteraction.find((s) => s.toLowerCase() === "hover") && foundInteraction.find((s) => s.toLowerCase() === "active" || s.toLowerCase() === "pressed")) {
        transitions.push({ from: "Hover", to: "Active", trigger: "ON_CLICK" });
        transitions.push({ from: "Active", to: "Hover", trigger: "MOUSE_UP" });
      }
      if (foundInteraction.find((s) => s.toLowerCase() === "focus")) {
        transitions.push({ from: "Default", to: "Focus", trigger: "ON_FOCUS" });
        transitions.push({ from: "Focus", to: "Default", trigger: "ON_BLUR" });
      }
    }
  }

  // Source 2: Prototype reactions
  if ("reactions" in node) {
    const reactions = (node as SceneNode & { reactions: readonly Reaction[] }).reactions;
    if (reactions && reactions.length > 0) {
      sources.push("prototype-reactions");
      for (const reaction of reactions) {
        if (reaction.trigger && reaction.actions) {
          for (const action of reaction.actions) {
            transitions.push({
              from: node.name,
              to: "destinationId" in action ? String(action.destinationId) : "unknown",
              trigger: reaction.trigger.type,
              action: action.type,
            });
          }
        }
      }
    }
  }

  // Source 3: Designer annotations
  try {
    const annotation = node.getSharedPluginData("forage", "state-rules");
    if (annotation) {
      sources.push("annotations");
      const parsed = JSON.parse(annotation);
      if (parsed.states) {
        for (const s of parsed.states) {
          if (!states.includes(s)) states.push(s);
        }
      }
      if (parsed.transitions) {
        transitions.push(...parsed.transitions);
      }
    }
  } catch {
    // No annotations or invalid JSON
  }

  // Confidence scoring
  let confidence = 0;
  if (sources.includes("variant-names")) confidence += 0.4;
  if (sources.includes("prototype-reactions")) confidence += 0.3;
  if (sources.includes("annotations")) confidence += 0.3;
  if (states.length === 0) confidence = 0;

  // Open questions
  if (states.length > 0 && transitions.length === 0) {
    openQuestions.push("States were found but no transitions could be inferred. How do users move between states?");
  }
  if (!sources.includes("annotations")) {
    openQuestions.push("No designer annotations found. Consider using forage_annotate_state to add explicit state rules.");
  }

  // Suggested implementation
  let suggestedImplementation: string | undefined;
  if (states.length > 0) {
    if (states.length <= 3 && transitions.length <= 4) {
      suggestedImplementation = "useState — simple enough for a single state variable";
    } else {
      suggestedImplementation = "useReducer — complex state machine with multiple transitions";
    }
  }

  return {
    nodeId: params.nodeId,
    nodeName: node.name,
    states,
    transitions,
    confidence,
    sources,
    openQuestions,
    suggestedImplementation,
  };
}

async function handleLintNaming(params: { pageId?: string }) {
  const page = params.pageId ? await findPageById(params.pageId) : figma.currentPage;
  await page.loadAsync();

  const genericPatterns = [
    /^Frame\s+\d+$/i,
    /^Group\s+\d+$/i,
    /^Rectangle\s+\d+$/i,
    /^Ellipse\s+\d+$/i,
    /^Line\s+\d+$/i,
    /^Vector\s+\d+$/i,
    /^Text\s+\d+$/i,
    /^Image\s+\d+$/i,
    /^Component\s+\d+$/i,
    /^Instance\s+\d+$/i,
  ];

  const issues: Array<{
    nodeId: string;
    name: string;
    type: string;
    issue: string;
    suggestion: string;
  }> = [];

  const allNodes = page.findAll(() => true);

  for (const node of allNodes) {
    for (const pattern of genericPatterns) {
      if (pattern.test(node.name)) {
        const typeLower = node.type.toLowerCase().replace("_", " ");
        issues.push({
          nodeId: node.id,
          name: node.name,
          type: node.type,
          issue: "generic-name",
          suggestion: `Rename "${node.name}" to describe its purpose (e.g., "hero-section", "nav-item", "cta-button" instead of generic ${typeLower} names)`,
        });
        break;
      }
    }
  }

  return {
    pageId: page.id,
    pageName: page.name,
    issues,
    issueCount: issues.length,
    totalNodes: allNodes.length,
  };
}

// ── Tier 6: Annotations ──────────────────────────────────────────────────────

async function handleGetAnnotations(params: { nodeId: string }) {
  const node = await findNodeById(params.nodeId);
  const raw = node.getSharedPluginData("forage", "state-rules");

  if (!raw) {
    return {
      nodeId: params.nodeId,
      nodeName: node.name,
      annotations: null,
      message: "No annotations found on this node. Use forage_annotate_state to add state rules.",
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      nodeId: params.nodeId,
      nodeName: node.name,
      annotations: parsed,
    };
  } catch {
    return {
      nodeId: params.nodeId,
      nodeName: node.name,
      annotations: null,
      rawData: raw,
      message: "Found annotation data but it is not valid JSON",
    };
  }
}

async function handleAnnotateState(params: {
  nodeId: string;
  annotation: string;
}) {
  const node = await findNodeById(params.nodeId);

  // Validate that annotation is valid JSON
  let parsed: unknown;
  try {
    parsed = typeof params.annotation === "string"
      ? JSON.parse(params.annotation)
      : params.annotation;
  } catch {
    throw {
      code: "INVALID_ANNOTATION",
      message: "Annotation must be valid JSON with states and transitions arrays",
    };
  }

  const json = typeof params.annotation === "string"
    ? params.annotation
    : JSON.stringify(params.annotation);

  node.setSharedPluginData("forage", "state-rules", json);

  return {
    nodeId: params.nodeId,
    nodeName: node.name,
    annotation: parsed,
    message: "State annotation saved successfully. It will persist in the Figma file.",
  };
}
