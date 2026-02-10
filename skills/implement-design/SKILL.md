---
name: implement-design
description: Implement a Figma design as code. Use when the user asks to build, implement, or code a design from Figma — including full pages, individual components, or entire design systems.
user-invocable: true
argument-hint: [figma-url-or-description]
---

# Implement a Figma Design

You are implementing a design from Figma using the Forage MCP tools. Your goal is to produce production-ready code that faithfully matches the design, using the user's existing tech stack.

The user wants you to implement: $ARGUMENTS

## Phase 0: Understand the Project Stack

Before touching Figma, understand what you're building with:

1. Look for configuration files to detect the stack:
   - `tailwind.config.*` → Tailwind CSS
   - `components.json` → shadcn/ui
   - `package.json` → React, Vue, Svelte, Next.js, etc.
   - `tsconfig.json` → TypeScript
   - Existing component directories → naming conventions, file structure patterns

2. Note the patterns already in use:
   - CSS approach (Tailwind utility classes, CSS modules, styled-components, etc.)
   - Component library (shadcn/ui, Radix, MUI, etc.)
   - File naming convention (PascalCase, kebab-case, etc.)
   - State management approach (useState, Zustand, Redux, etc.)

**Do not invent a stack. Match what exists in the project.**

## Phase 1: Extract the Design System

Do this ONCE at the start. These tokens inform everything you build.

1. **Get design tokens** in the format matching the project:
   - If Tailwind: `forage_get_design_tokens` with `format: "tailwind"` → extend `tailwind.config`
   - If CSS variables: `forage_get_design_tokens` with `format: "css"` → add to global styles
   - Otherwise: `forage_get_design_tokens` with `format: "json"` → create constants file

2. **Get variables** with `forage_get_variables` to understand mode support (light/dark themes)

3. **Get styles** with `forage_get_styles` for any paint/text/effect styles not captured in variables

**Output**: Update or create the project's token/theme configuration before building any components.

## Phase 2: Survey the Design

Understand the full scope before implementing anything.

1. `forage_list_pages` → see all pages
2. `forage_list_frames` on the relevant page → see top-level structure
3. `forage_find_reusable` → find components used more than once (these are your implementation priorities)
4. `forage_get_children` on key frames with `depth: 2` → understand layout hierarchy

**Output**: A mental map of what needs to be built and in what order.

## Phase 3: Build Components (Atoms First)

Work bottom-up. Build the most reused, smallest components first.

For each component identified in Phase 2:

1. **Inspect it**: `forage_get_node_detail` with `includeCss: true`
2. **If it's a component set (has variants)**:
   - `forage_get_variants` → understand all variant combinations
   - `forage_compare_variants` on key pairs (e.g., Default vs Hover, Default vs Disabled) → only code the differences
   - `forage_infer_states` → get suggested state machine and React implementation approach
3. **Get CSS if needed**: `forage_get_css` for specific styling details
4. **Get images**: `forage_get_images` with `format: "SVG"` for icons, `format: "PNG"` for photos/complex graphics
5. **Check for annotations**: `forage_get_annotations` for any designer-specified behavior

**When building the component:**
- Map Figma auto-layout → CSS flexbox (layoutMode HORIZONTAL → flex-row, VERTICAL → flex-col)
- Map Figma padding/gap → Tailwind spacing utilities or CSS
- Map variant properties → component props
- Map interaction states (from `forage_infer_states`) → event handlers + state
- Use tokens from Phase 1, never hardcode colors/spacing/typography
- If shadcn/ui or similar is in the project, extend existing components rather than building from scratch
- If the component closely matches an existing library component, use that as the base

## Phase 4: Assemble Layouts

Once components are built, compose them into page layouts.

1. `forage_get_children` on the page frame → understand the layout structure
2. `forage_get_node_detail` on each section → get layout properties (flex direction, gap, padding)
3. Build layouts using your components from Phase 3

**Key mappings:**
- Figma frame with auto-layout → flex container
- `layoutMode: "VERTICAL"` → `flex-col`
- `layoutMode: "HORIZONTAL"` → `flex-row`
- `primaryAxisAlignItems: "CENTER"` → `justify-center`
- `counterAxisAlignItems: "CENTER"` → `items-center`
- `itemSpacing` → `gap-{n}`
- `paddingLeft/Right/Top/Bottom` → `px-{n} py-{n}` or `p-{n}`

## Phase 5: Quality Check

1. `forage_lint_naming` → check if there are poorly named layers you might have misinterpreted
2. Compare your implementation against the design by reviewing:
   - Are all components from `forage_find_reusable` implemented?
   - Do variant props match what `forage_get_variants` returned?
   - Are design tokens used consistently (no hardcoded values)?
   - Does the state management match what `forage_infer_states` suggested?

## Rules

- **Never hardcode colors, spacing, or typography.** Always use tokens/variables from Phase 1.
- **Never guess at spacing or sizing.** Get the actual values from `forage_get_node_detail`.
- **Prefer `forage_get_children` with depth 1-2** over deep recursion. Navigate progressively.
- **Don't call `forage_get_node_detail` on every node.** Use it on components you're actually implementing, not for browsing.
- **Use `forage_compare_variants` instead of inspecting each variant individually.** It returns only what changed, saving tokens.
- **Check `forage_get_selection`** if the user says "implement this" or "look at what I selected" without specifying a node.
- **Build from the bottom up.** Tokens → atoms → molecules → organisms → layouts → pages.
