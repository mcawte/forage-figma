// ── Constants ──────────────────────────────────────────────────────────────────
export const WS_PORT = 18412;
export const PLUGIN_NAMESPACE = "forage";
export const PLUGIN_DATA_KEY_STATE_RULES = "state-rules";
export const REQUEST_TIMEOUT_MS = 10_000;

// ── WebSocket Bridge Protocol ─────────────────────────────────────────────────

export interface ForageCommand {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface ForageResponse {
  id: string;
  type: "response";
  result?: unknown;
  error?: ForageError;
}

export interface ForageError {
  code: string;
  message: string;
}

// ── Simplified Node Types (token-efficient representations) ───────────────────

export interface SimplifiedPage {
  id: string;
  name: string;
  childCount: number;
}

export interface SimplifiedNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  childCount?: number;

  // Size
  width?: number;
  height?: number;

  // Auto-layout
  layoutMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  layoutAlign?: string;
  layoutGrow?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  counterAxisSpacing?: number;

  // Component info
  isComponent?: boolean;
  isComponentSet?: boolean;
  isInstance?: boolean;
  componentProperties?: Record<string, unknown>;
  variantProperties?: Record<string, string> | null;
  mainComponentId?: string;

  // Styles
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  opacity?: number;
  cornerRadius?: number;
  borderRadius?: string;

  // Typography
  fontSize?: number;
  fontName?: unknown;
  fontWeight?: number;
  lineHeight?: unknown;
  letterSpacing?: unknown;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  textContent?: string;
  textDecoration?: string;
  textCase?: string;

  // Constraints
  constraints?: unknown;

  // Blend mode
  blendMode?: string;
}

export interface SimplifiedFrame extends SimplifiedNode {
  children?: SimplifiedNode[];
}

// ── Design Token Types ────────────────────────────────────────────────────────

export type TokenFormat = "tailwind" | "css" | "json";

export interface DesignVariable {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, unknown>;
  scopes: string[];
}

export interface DesignStyle {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

// ── Annotation Types ──────────────────────────────────────────────────────────

export interface StateAnnotation {
  states: string[];
  transitions: Array<{
    from: string;
    to: string;
    trigger: string;
  }>;
  notes?: string;
}

// ── State Inference Types ─────────────────────────────────────────────────────

export interface InferredStateMachine {
  states: string[];
  transitions: Array<{
    from: string;
    to: string;
    trigger: string;
    action?: string;
  }>;
  confidence: number;
  sources: string[];
  openQuestions: string[];
  suggestedImplementation?: string;
}

// ── Command Method Names ──────────────────────────────────────────────────────

export type CommandMethod =
  | "getPages"
  | "getFrames"
  | "getSelection"
  | "getChildren"
  | "getVariants"
  | "searchNodes"
  | "getNodeDetail"
  | "getCss"
  | "getImages"
  | "getDesignTokens"
  | "getVariables"
  | "getStyles"
  | "compareVariants"
  | "findReusable"
  | "findSimilar"
  | "inferStates"
  | "lintNaming"
  | "getAnnotations"
  | "annotateState";
