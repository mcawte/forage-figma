import { describe, it, expect, afterEach } from "vitest";
import { PluginBridge } from "../bridge";
import WebSocket from "ws";

describe("PluginBridge", () => {
  let bridge: PluginBridge;

  afterEach(async () => {
    if (bridge) {
      await bridge.close();
    }
  });

  it("should start WebSocket server on specified port", () => {
    bridge = new PluginBridge(0); // port 0 = random available port
    expect(bridge.connected).toBe(false);
  });

  it("should report not connected when no plugin is connected", () => {
    bridge = new PluginBridge(0);
    expect(bridge.connected).toBe(false);
  });

  it("should throw when sending without plugin connected", async () => {
    bridge = new PluginBridge(0);
    await expect(bridge.send("getPages")).rejects.toThrow(
      "Not connected to Figma plugin",
    );
  });

  it("should accept a plugin connection and relay messages", async () => {
    bridge = new PluginBridge(0);

    // Get the actual port
    const address = (bridge as unknown as { wss: { address: () => { port: number } } }).wss.address();
    const port = address.port;

    // Connect a mock plugin
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      client.on("open", resolve);
    });

    expect(bridge.connected).toBe(true);

    // Set up client to echo back a response
    client.on("message", (data: Buffer) => {
      const command = JSON.parse(data.toString());
      client.send(
        JSON.stringify({
          id: command.id,
          type: "response",
          result: { pages: [{ id: "0:1", name: "Page 1", childCount: 3 }] },
        }),
      );
    });

    // Send a command through the bridge
    const result = await bridge.send("getPages");
    expect(result).toEqual({
      pages: [{ id: "0:1", name: "Page 1", childCount: 3 }],
    });

    client.close();
  });

  it("should handle error responses from plugin", async () => {
    bridge = new PluginBridge(0);
    const address = (bridge as unknown as { wss: { address: () => { port: number } } }).wss.address();
    const port = address.port;

    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      client.on("open", resolve);
    });

    client.on("message", (data: Buffer) => {
      const command = JSON.parse(data.toString());
      client.send(
        JSON.stringify({
          id: command.id,
          type: "response",
          error: { code: "NODE_NOT_FOUND", message: "Node not found: 999:999" },
        }),
      );
    });

    await expect(bridge.send("getNodeDetail", { nodeId: "999:999" })).rejects.toThrow(
      "[NODE_NOT_FOUND] Node not found: 999:999",
    );

    client.close();
  });

  it("should reject pending requests when plugin disconnects", async () => {
    bridge = new PluginBridge(0);
    const address = (bridge as unknown as { wss: { address: () => { port: number } } }).wss.address();
    const port = address.port;

    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      client.on("open", resolve);
    });

    // Don't respond — just disconnect
    const sendPromise = bridge.send("getPages");
    // Give the message time to be sent
    await new Promise((r) => setTimeout(r, 50));
    client.close();

    await expect(sendPromise).rejects.toThrow("Figma plugin disconnected");
  });
});
