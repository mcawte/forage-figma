# Forage — Claude Skill Companion Guide

## What is Forage?

Forage is a Figma MCP that lets you explore and extract design information progressively. Instead of getting a massive JSON dump, you navigate the Figma file step by step, only requesting what you need.

## How to Use Forage

### Step 1: Discover the File Structure

Start with `forage_list_pages` to see all pages, then `forage_list_frames` to see top-level frames in a specific page.

### Step 2: Navigate Progressively

Use `forage_get_children` to drill into the tree. Start with `depth: 1` and only go deeper when needed. Use `forage_search_nodes` to find specific elements by name or type.

### Step 3: Get Implementation Details

Once you've found the node you need, use `forage_get_node_detail` for complete implementation data, `forage_get_css` for CSS properties, or `forage_get_images` for visual assets.

### Step 4: Extract the Design System

Use `forage_get_design_tokens` with the appropriate format:
- `"tailwind"` for Tailwind CSS projects
- `"css"` for CSS custom properties
- `"json"` for framework-agnostic data

### Step 5: Understand Component Behavior

For interactive components:
1. Use `forage_get_variants` to see all variants
2. Use `forage_compare_variants` to understand what changes between states
3. Use `forage_infer_states` to get a state machine suggestion

### Step 6: Prioritize Implementation

Use `forage_find_reusable` to find the most-used components — implement those first for maximum impact.

## Key Principles

- **Progressive disclosure**: Start broad (pages), then narrow (frames → children → detail)
- **Token efficiency**: Every response is simplified to minimize context usage
- **Implementation-ready**: The detail tools give you everything needed to write code
- **Design system aware**: Extract tokens in the format your framework needs

## Tool Quick Reference

| I want to... | Use this tool |
|---|---|
| See what's in the file | `forage_list_pages` |
| See a page's structure | `forage_list_frames` |
| Work with user's selection | `forage_get_selection` |
| Drill into a component | `forage_get_children` |
| See variant options | `forage_get_variants` |
| Find something by name | `forage_search_nodes` |
| Get full implementation data | `forage_get_node_detail` |
| Get CSS for a node | `forage_get_css` |
| Export an image | `forage_get_images` |
| Get design tokens | `forage_get_design_tokens` |
| See all variables | `forage_get_variables` |
| See all styles | `forage_get_styles` |
| Compare two variants | `forage_compare_variants` |
| Find reusable components | `forage_find_reusable` |
| Find similar components | `forage_find_similar` |
| Understand state behavior | `forage_infer_states` |
| Check naming quality | `forage_lint_naming` |
| Read designer notes | `forage_get_annotations` |
| Add state rules | `forage_annotate_state` |
