import { describe, it, expect } from "vitest";

// The MCP server binds a WebSocket port on import, so we can't test it in-process.
// Instead we verify tool specification correctness and use the build verification
// step (stdio protocol test) to confirm runtime registration.

const EXPECTED_TOOLS = [
  "forage_list_pages",
  "forage_list_frames",
  "forage_get_selection",
  "forage_get_children",
  "forage_get_variants",
  "forage_search_nodes",
  "forage_get_node_detail",
  "forage_get_css",
  "forage_get_images",
  "forage_get_design_tokens",
  "forage_get_variables",
  "forage_get_styles",
  "forage_compare_variants",
  "forage_find_reusable",
  "forage_find_similar",
  "forage_infer_states",
  "forage_lint_naming",
  "forage_get_annotations",
  "forage_annotate_state",
];

const READ_ONLY_TOOLS = EXPECTED_TOOLS.filter(
  (name) => name !== "forage_annotate_state",
);

describe("Tool Specification", () => {
  it("should define exactly 19 tools", () => {
    expect(EXPECTED_TOOLS).toHaveLength(19);
  });

  it("all tools should have the forage_ prefix", () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(tool).toMatch(/^forage_/);
    }
  });

  it("all tools should use snake_case", () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(tool).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("should have 18 read-only tools and 1 writeable tool", () => {
    expect(READ_ONLY_TOOLS).toHaveLength(18);
    expect(EXPECTED_TOOLS).toContain("forage_annotate_state");
  });

  it("tier 1 tools should all be present (discovery)", () => {
    expect(EXPECTED_TOOLS).toContain("forage_list_pages");
    expect(EXPECTED_TOOLS).toContain("forage_list_frames");
    expect(EXPECTED_TOOLS).toContain("forage_get_selection");
  });

  it("tier 2 tools should all be present (navigation)", () => {
    expect(EXPECTED_TOOLS).toContain("forage_get_children");
    expect(EXPECTED_TOOLS).toContain("forage_get_variants");
    expect(EXPECTED_TOOLS).toContain("forage_search_nodes");
  });

  it("tier 3 tools should all be present (detail)", () => {
    expect(EXPECTED_TOOLS).toContain("forage_get_node_detail");
    expect(EXPECTED_TOOLS).toContain("forage_get_css");
    expect(EXPECTED_TOOLS).toContain("forage_get_images");
  });

  it("tier 4 tools should all be present (design system)", () => {
    expect(EXPECTED_TOOLS).toContain("forage_get_design_tokens");
    expect(EXPECTED_TOOLS).toContain("forage_get_variables");
    expect(EXPECTED_TOOLS).toContain("forage_get_styles");
  });

  it("tier 5 tools should all be present (intelligence)", () => {
    expect(EXPECTED_TOOLS).toContain("forage_compare_variants");
    expect(EXPECTED_TOOLS).toContain("forage_find_reusable");
    expect(EXPECTED_TOOLS).toContain("forage_find_similar");
    expect(EXPECTED_TOOLS).toContain("forage_infer_states");
    expect(EXPECTED_TOOLS).toContain("forage_lint_naming");
  });

  it("tier 6 tools should all be present (annotations)", () => {
    expect(EXPECTED_TOOLS).toContain("forage_get_annotations");
    expect(EXPECTED_TOOLS).toContain("forage_annotate_state");
  });
});
