import { createHomebridgeCli } from "./cli.js";

export { createHomebridgeCli } from "./cli.js";
export * from "./client.js";
export * from "./credentials.js";
export * from "./operations.js";
export * from "./plugin-socket.js";
export * from "./swagger.js";

if (process.env.NODE_ENV !== "test") {
  await createHomebridgeCli().serve();
}
