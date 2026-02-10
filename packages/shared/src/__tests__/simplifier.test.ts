import { describe, it, expect } from "vitest";

// The simplifier runs in the Figma plugin sandbox, so we test the simplification
// logic by replicating the key functions here with mock data.

interface MockNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  width?: number;
  height?: number;
  children?: MockNode[];
  layoutMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  opacity?: number;
  cornerRadius?: number | "mixed";
  fontSize?: number;
  characters?: string;
  x?: number;
  y?: number;
  absoluteTransform?: unknown;
  pluginData?: Record<string, string>;
}

// Simplified version of the plugin's simplifyNode for testing
function simplifyNode(node: MockNode): Record<string, unknown> {
  const simplified: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if (node.visible === false) simplified.visible = false;
  if (node.width !== undefined) simplified.width = Math.round(node.width);
  if (node.height !== undefined) simplified.height = Math.round(node.height);

  if (node.children) {
    simplified.childCount = node.children.length;
  }

  if (node.layoutMode && node.layoutMode !== "NONE") {
    simplified.layoutMode = node.layoutMode;
    simplified.primaryAxisAlignItems = node.primaryAxisAlignItems;
    simplified.counterAxisAlignItems = node.counterAxisAlignItems;
    simplified.paddingLeft = node.paddingLeft;
    simplified.paddingRight = node.paddingRight;
    simplified.paddingTop = node.paddingTop;
    simplified.paddingBottom = node.paddingBottom;
    simplified.itemSpacing = node.itemSpacing;
  }

  if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
    simplified.fills = node.fills;
  }

  if (node.opacity !== undefined && node.opacity !== 1) {
    simplified.opacity = node.opacity;
  }

  if (node.type === "TEXT" && node.characters) {
    simplified.textContent = node.characters;
    if (node.fontSize) simplified.fontSize = node.fontSize;
  }

  // These should NOT appear in output (stripped)
  // - absolute coordinates (x, y)
  // - absoluteTransform
  // - pluginData from other plugins

  return simplified;
}

describe("Node Simplifier", () => {
  it("should include id, name, and type", () => {
    const node: MockNode = { id: "1:2", name: "Button", type: "FRAME" };
    const result = simplifyNode(node);
    expect(result.id).toBe("1:2");
    expect(result.name).toBe("Button");
    expect(result.type).toBe("FRAME");
  });

  it("should strip absolute coordinates (x, y)", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Button",
      type: "FRAME",
      x: 100,
      y: 200,
      width: 300,
      height: 40,
    };
    const result = simplifyNode(node);
    expect(result).not.toHaveProperty("x");
    expect(result).not.toHaveProperty("y");
    expect(result.width).toBe(300);
    expect(result.height).toBe(40);
  });

  it("should strip absoluteTransform", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Button",
      type: "FRAME",
      absoluteTransform: [[1, 0, 100], [0, 1, 200]],
    };
    const result = simplifyNode(node);
    expect(result).not.toHaveProperty("absoluteTransform");
  });

  it("should strip pluginData from other plugins", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Button",
      type: "FRAME",
      pluginData: { someOtherPlugin: "data" },
    };
    const result = simplifyNode(node);
    expect(result).not.toHaveProperty("pluginData");
  });

  it("should include child count but not full children by default", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Container",
      type: "FRAME",
      children: [
        { id: "1:3", name: "Child 1", type: "TEXT" },
        { id: "1:4", name: "Child 2", type: "RECTANGLE" },
      ],
    };
    const result = simplifyNode(node);
    expect(result.childCount).toBe(2);
    expect(result).not.toHaveProperty("children");
  });

  it("should include auto-layout properties when layoutMode is set", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Row",
      type: "FRAME",
      layoutMode: "HORIZONTAL",
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "MIN",
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
      itemSpacing: 12,
    };
    const result = simplifyNode(node);
    expect(result.layoutMode).toBe("HORIZONTAL");
    expect(result.primaryAxisAlignItems).toBe("CENTER");
    expect(result.itemSpacing).toBe(12);
    expect(result.paddingLeft).toBe(16);
  });

  it("should not include layout properties when layoutMode is NONE", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Frame",
      type: "FRAME",
      layoutMode: "NONE",
      paddingLeft: 0,
    };
    const result = simplifyNode(node);
    expect(result).not.toHaveProperty("layoutMode");
    expect(result).not.toHaveProperty("paddingLeft");
  });

  it("should include visible fills only", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Box",
      type: "RECTANGLE",
      fills: [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 1 } }],
    };
    const result = simplifyNode(node);
    expect(result.fills).toHaveLength(1);
  });

  it("should omit empty fills", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Box",
      type: "RECTANGLE",
      fills: [],
    };
    const result = simplifyNode(node);
    expect(result).not.toHaveProperty("fills");
  });

  it("should include opacity only when not 1", () => {
    const full: MockNode = { id: "1:2", name: "A", type: "FRAME", opacity: 1 };
    const partial: MockNode = { id: "1:3", name: "B", type: "FRAME", opacity: 0.5 };

    expect(simplifyNode(full)).not.toHaveProperty("opacity");
    expect(simplifyNode(partial).opacity).toBe(0.5);
  });

  it("should omit visibility when node is visible", () => {
    const visible: MockNode = { id: "1:2", name: "A", type: "FRAME", visible: true };
    const hidden: MockNode = { id: "1:3", name: "B", type: "FRAME", visible: false };

    expect(simplifyNode(visible)).not.toHaveProperty("visible");
    expect(simplifyNode(hidden).visible).toBe(false);
  });

  it("should include text content for TEXT nodes", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Heading",
      type: "TEXT",
      characters: "Hello World",
      fontSize: 24,
    };
    const result = simplifyNode(node);
    expect(result.textContent).toBe("Hello World");
    expect(result.fontSize).toBe(24);
  });

  it("should round dimensions to integers", () => {
    const node: MockNode = {
      id: "1:2",
      name: "Button",
      type: "FRAME",
      width: 123.456,
      height: 44.789,
    };
    const result = simplifyNode(node);
    expect(result.width).toBe(123);
    expect(result.height).toBe(45);
  });
});
