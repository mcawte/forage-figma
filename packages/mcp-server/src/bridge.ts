import { WebSocketServer, WebSocket } from "ws";
import type { ForageCommand, ForageResponse } from "@forage/shared";
import { WS_PORT, REQUEST_TIMEOUT_MS } from "@forage/shared";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PluginBridge {
  private wss: WebSocketServer;
  private plugin: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private nextId = 0;

  constructor(port: number = WS_PORT) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    console.error(`[forage] WebSocket server listening on ws://localhost:${port}`);
  }

  private handleConnection(ws: WebSocket): void {
    // If there's already a plugin connected, close the old one
    if (this.plugin && this.plugin.readyState === WebSocket.OPEN) {
      console.error("[forage] New plugin connection replacing existing one");
      this.plugin.close();
    }

    console.error("[forage] Figma plugin connected");
    this.plugin = ws;

    ws.on("message", (data: Buffer) => {
      try {
        const response: ForageResponse = JSON.parse(data.toString());
        const pending = this.pendingRequests.get(response.id);
        if (!pending) return;

        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(
            new Error(`[${response.error.code}] ${response.error.message}`),
          );
        } else {
          pending.resolve(response.result);
        }
      } catch (e) {
        console.error("[forage] Failed to parse plugin response:", e);
      }
    });

    ws.on("close", () => {
      console.error("[forage] Figma plugin disconnected");
      if (this.plugin === ws) {
        this.plugin = null;
      }
      // Reject all pending requests for this connection
      for (const [id, req] of this.pendingRequests) {
        clearTimeout(req.timer);
        req.reject(new Error("Figma plugin disconnected"));
        this.pendingRequests.delete(id);
      }
    });

    ws.on("error", (err) => {
      console.error("[forage] WebSocket error:", err.message);
    });
  }

  async send(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.plugin || this.plugin.readyState !== WebSocket.OPEN) {
      throw new Error(
        "Not connected to Figma plugin. Is the Forage plugin running in Figma?",
      );
    }

    const id = String(++this.nextId);
    const command: ForageCommand = { id, method, params };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out after 10s: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.plugin!.send(JSON.stringify(command));
    });
  }

  get connected(): boolean {
    return this.plugin !== null && this.plugin.readyState === WebSocket.OPEN;
  }

  async close(): Promise<void> {
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
    }
    this.pendingRequests.clear();
    return new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
