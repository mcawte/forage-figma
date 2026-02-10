import { describe, it, expect } from "vitest";
import {
  WS_PORT,
  PLUGIN_NAMESPACE,
  PLUGIN_DATA_KEY_STATE_RULES,
  REQUEST_TIMEOUT_MS,
} from "../index";

describe("shared constants", () => {
  it("WS_PORT is 18412", () => {
    expect(WS_PORT).toBe(18412);
  });

  it("PLUGIN_NAMESPACE is forage", () => {
    expect(PLUGIN_NAMESPACE).toBe("forage");
  });

  it("PLUGIN_DATA_KEY_STATE_RULES is state-rules", () => {
    expect(PLUGIN_DATA_KEY_STATE_RULES).toBe("state-rules");
  });

  it("REQUEST_TIMEOUT_MS is 10000", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
  });
});
