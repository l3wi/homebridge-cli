import { io } from "socket.io-client";
import { normalizeBaseUrl } from "./client.js";
import type { HomebridgeProfile } from "./credentials.js";

export type PluginSocketAction = "install" | "uninstall" | "update";

export type PluginSocketEvent =
  | {
      data: unknown;
      type: "result";
    }
  | {
      message: string;
      type: "stderr" | "stdout" | "status";
    };

export type PluginSocketTarget = {
  name: string;
  termCols?: number;
  termRows?: number;
  version?: string;
};

type PluginSocket = {
  disconnect(): void;
  emit(
    event: string,
    payload: unknown,
    callback?: (result: unknown) => void,
  ): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
};

type PluginSocketFactory = (
  url: string,
  options: {
    query: { token: string };
    reconnection: boolean;
    timeout: number;
    transports: string[];
  },
) => PluginSocket;

export type RunPluginSocketActionOptions = {
  action?: PluginSocketAction;
  socketFactory?: PluginSocketFactory;
  timeoutMs?: number;
};

export async function* runPluginSocketAction(
  profile: HomebridgeProfile,
  target: PluginSocketTarget,
  options: RunPluginSocketActionOptions = {},
): AsyncGenerator<PluginSocketEvent> {
  const action = options.action ?? "update";
  const queue = new AsyncEventQueue<PluginSocketEvent>();
  let completed = false;
  const socket = (options.socketFactory ?? defaultSocketFactory)(
    new URL("/plugins", normalizeBaseUrl(profile.url)).toString(),
    {
      query: { token: profile.token },
      reconnection: false,
      timeout: options.timeoutMs ?? 15_000,
      transports: ["websocket"],
    },
  );

  socket.on("connect", () => {
    queue.push({
      message: `Connected to Homebridge plugin socket for ${action}.`,
      type: "status",
    });
    socket.emit(action, pluginSocketPayload(target), (result: unknown) => {
      completed = true;
      if (result === true) {
        queue.push({ data: { action, plugin: target.name }, type: "result" });
        queue.finish();
        return;
      }
      queue.fail(
        new Error(
          `Homebridge plugin ${action} failed: ${formatResult(result)}`,
        ),
      );
    });
  });
  socket.on("connect_error", (error) => {
    queue.fail(
      toError(error, "Unable to connect to Homebridge plugin socket."),
    );
  });
  socket.on("disconnect", (reason) => {
    if (!completed) {
      queue.fail(
        new Error(
          `Homebridge plugin socket disconnected before ${action} completed: ${String(reason)}`,
        ),
      );
    }
  });
  socket.on("stdout", (message) => {
    queue.push({ message: String(message), type: "stdout" });
  });
  socket.on("stderr", (message) => {
    queue.push({ message: String(message), type: "stderr" });
  });

  try {
    for await (const event of queue) yield event;
  } finally {
    socket.disconnect();
  }
}

export function pluginSocketPayload(target: PluginSocketTarget) {
  return {
    name: target.name,
    termCols: target.termCols ?? 120,
    termRows: target.termRows ?? 30,
    version: target.version ?? "latest",
  };
}

function defaultSocketFactory(
  url: string,
  options: Parameters<PluginSocketFactory>[1],
): PluginSocket {
  return io(url, options);
}

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : fallback);
}

class AsyncEventQueue<T> implements AsyncIterable<T> {
  private done = false;
  private error: Error | undefined;
  private readonly items: T[] = [];
  private resolver: (() => void) | undefined;

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: async () => {
        while (!this.items.length && !this.done && !this.error) {
          await new Promise<void>((resolve) => {
            this.resolver = resolve;
          });
        }
        if (this.error) throw this.error;
        const value = this.items.shift();
        return value === undefined
          ? { done: true, value: undefined }
          : { done: false, value };
      },
    };
  }

  fail(error: Error): void {
    this.error = error;
    this.wake();
  }

  finish(): void {
    this.done = true;
    this.wake();
  }

  push(item: T): void {
    this.items.push(item);
    this.wake();
  }

  private wake(): void {
    this.resolver?.();
    this.resolver = undefined;
  }
}
