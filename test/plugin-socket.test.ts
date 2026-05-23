import { describe, expect, it } from "vitest";
import {
  pluginSocketPayload,
  runPluginSocketAction,
  type PluginSocketEvent,
} from "../src/plugin-socket.js";

describe("plugin socket actions", () => {
  it("connects to the plugins namespace and streams a successful update", async () => {
    const socket = new FakePluginSocket((event, payload, ack) => {
      expect(event).toBe("update");
      expect(payload).toEqual({
        name: "homebridge-example",
        termCols: 100,
        termRows: 25,
        version: "latest",
      });
      socket.serverEmit("stdout", "installing");
      ack?.(true);
    });
    let socketUrl = "";
    let token = "";

    const events = await collect(
      runPluginSocketAction(
        {
          savedAt: "2026-05-23T00:00:00.000Z",
          token: "jwt-1",
          url: "http://pi.lan:8581",
        },
        {
          name: "homebridge-example",
          termCols: 100,
          termRows: 25,
          version: "latest",
        },
        {
          socketFactory: (url, options) => {
            socketUrl = url;
            token = options.query.token;
            queueMicrotask(() => socket.serverEmit("connect"));
            return socket;
          },
        },
      ),
    );

    expect(socketUrl).toBe("http://pi.lan:8581/plugins");
    expect(token).toBe("jwt-1");
    expect(socket.disconnected).toBe(true);
    expect(events).toEqual([
      {
        message: "Connected to Homebridge plugin socket for update.",
        type: "status",
      },
      { message: "installing", type: "stdout" },
      {
        data: { action: "update", plugin: "homebridge-example" },
        type: "result",
      },
    ]);
  });

  it("throws when Homebridge rejects the update acknowledgement", async () => {
    const socket = new FakePluginSocket((_event, _payload, ack) => {
      ack?.({ message: "bad version" });
    });

    await expect(
      collect(
        runPluginSocketAction(
          {
            savedAt: "2026-05-23T00:00:00.000Z",
            token: "jwt-1",
            url: "http://pi.lan:8581",
          },
          { name: "homebridge-example" },
          {
            socketFactory: () => {
              queueMicrotask(() => socket.serverEmit("connect"));
              return socket;
            },
          },
        ),
      ),
    ).rejects.toThrow(
      'Homebridge plugin update failed: {"message":"bad version"}',
    );
  });

  it("builds the payload expected by Homebridge UI", () => {
    expect(pluginSocketPayload({ name: "homebridge-example" })).toEqual({
      name: "homebridge-example",
      termCols: 120,
      termRows: 30,
      version: "latest",
    });
  });
});

async function collect(
  events: AsyncGenerator<PluginSocketEvent>,
): Promise<PluginSocketEvent[]> {
  const collected: PluginSocketEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

class FakePluginSocket {
  disconnected = false;
  private readonly handlers = new Map<
    string,
    ((...args: unknown[]) => void)[]
  >();

  constructor(
    private readonly onClientEmit: (
      event: string,
      payload: unknown,
      ack?: (result: unknown) => void,
    ) => void,
  ) {}

  disconnect(): void {
    this.disconnected = true;
  }

  emit(event: string, payload: unknown, ack?: (result: unknown) => void): void {
    this.onClientEmit(event, payload, ack);
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(callback);
    this.handlers.set(event, handlers);
  }

  serverEmit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}
