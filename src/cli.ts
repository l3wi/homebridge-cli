import { Cli, z } from "incur";
import { credentialsPath, getProfile, saveProfile } from "./credentials.js";
import { createClient, login, type HttpMethod } from "./client.js";
import {
  createOperationDefinition,
  groupDescriptions,
  operations,
} from "./operations.js";
import { parseJsonObject, parseJsonValue } from "./json.js";
import { runPluginSocketAction } from "./plugin-socket.js";
import { compareSwaggerCoverage, fetchSwaggerOperations } from "./swagger.js";

const version = "0.1.0";

export function createHomebridgeCli() {
  const root = Cli.create("homebridge", {
    aliases: ["homebridge-cli"],
    description: "CLI and MCP interface for the Homebridge UI API.",
    version,
  });

  root.command(createAuthGroup());
  root.command(createRawApiGroup());

  for (const groupName of Object.keys(groupDescriptions)) {
    const group = Cli.create(groupName, {
      description: groupDescriptions[groupName],
    });
    for (const operation of operations.filter(
      (item) => item.group === groupName,
    )) {
      group.command(operation.command, createOperationDefinition(operation));
    }
    if (groupName === "plugins") addPluginManagementCommands(group);
    root.command(group);
  }

  return root;
}

function createAuthGroup() {
  return Cli.create("auth", {
    description: "Authentication and credential profile commands",
  })
    .command("login", {
      description:
        "Exchange username/password for a token and save it to ~/.homebridge/credentials.json.",
      options: z.object({
        otp: z.string().optional().describe("Two-factor authentication code."),
        password: z.string().optional().describe("Homebridge UI password."),
        passwordStdin: z
          .boolean()
          .default(false)
          .describe("Read the Homebridge UI password from stdin."),
        profile: z
          .string()
          .default("default")
          .describe("Credential profile name."),
        url: z
          .string()
          .url()
          .describe("Homebridge UI base URL, for example http://pi.lan:8581."),
        username: z.string().describe("Homebridge UI username."),
      }),
      env: z.object({
        HOMEBRIDGE_PASSWORD: z.string().optional(),
      }),
      async run(c) {
        const password =
          c.options.password ??
          c.env.HOMEBRIDGE_PASSWORD ??
          (c.options.passwordStdin ? await readStandardInput() : undefined);
        if (!password) {
          throw new Error(
            "Password required. Pass --password, set HOMEBRIDGE_PASSWORD, or use --password-stdin.",
          );
        }
        const result = await login({ ...c.options, password });
        await saveProfile(
          {
            token: result.token,
            url: c.options.url,
            username: c.options.username,
            savedAt: new Date().toISOString(),
          },
          { name: c.options.profile },
        );
        return {
          credentialsPath: credentialsPath(),
          profile: c.options.profile,
          url: c.options.url,
          username: c.options.username,
        };
      },
    })
    .command("save-token", {
      description:
        "Save an existing Homebridge bearer token to ~/.homebridge/credentials.json.",
      options: z.object({
        profile: z
          .string()
          .default("default")
          .describe("Credential profile name."),
        token: z.string().describe("Homebridge bearer token."),
        url: z.string().url().describe("Homebridge UI base URL."),
        username: z.string().optional().describe("Optional username label."),
      }),
      async run(c) {
        await saveProfile(
          {
            token: c.options.token,
            url: c.options.url,
            username: c.options.username,
            savedAt: new Date().toISOString(),
          },
          { name: c.options.profile },
        );
        return {
          credentialsPath: credentialsPath(),
          profile: c.options.profile,
          url: c.options.url,
          username: c.options.username,
        };
      },
    })
    .command("noauth", {
      description:
        "Obtain and save a token when Homebridge UI authentication is disabled.",
      options: z.object({
        profile: z
          .string()
          .default("default")
          .describe("Credential profile name."),
        url: z.string().url().describe("Homebridge UI base URL."),
      }),
      async run(c) {
        const client = await createClient({
          profile: {
            token: "",
            url: c.options.url,
            savedAt: new Date().toISOString(),
          },
        });
        const response = await client.request({
          authenticated: false,
          method: "POST",
          path: "/api/auth/noauth",
        });
        const token = responseToken(response);
        if (!token) throw new Error("No-auth endpoint did not return a token.");
        await saveProfile(
          { token, url: c.options.url, savedAt: new Date().toISOString() },
          { name: c.options.profile },
        );
        return {
          credentialsPath: credentialsPath(),
          profile: c.options.profile,
          url: c.options.url,
        };
      },
    })
    .command("check", {
      description: "Check whether the saved token is valid.",
      options: z.object({
        profile: z.string().optional().describe("Credential profile name."),
      }),
      async run(c) {
        const client = await createClient({ profileName: c.options.profile });
        return client.request({ method: "GET", path: "/api/auth/check" });
      },
    })
    .command("settings", {
      description: "Return Homebridge UI auth settings.",
      options: z.object({
        profile: z.string().optional().describe("Credential profile name."),
      }),
      async run(c) {
        const profile = await getProfile({ name: c.options.profile });
        if (profile) {
          const client = await createClient({ profile });
          return client.request({ method: "GET", path: "/api/auth/settings" });
        }
        throw new Error(
          "No saved credentials. Use `homebridge api get /api/auth/settings --no-auth --url <url>` for unauthenticated settings.",
        );
      },
    })
    .command("profile", {
      description: "Show the active saved profile without printing the token.",
      options: z.object({
        profile: z.string().optional().describe("Credential profile name."),
      }),
      async run(c) {
        const profile = await getProfile({ name: c.options.profile });
        if (!profile) throw new Error("No saved Homebridge credentials found.");
        return {
          savedAt: profile.savedAt,
          tokenSaved: Boolean(profile.token),
          url: profile.url,
          username: profile.username,
        };
      },
    });
}

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trimEnd();
}

function createRawApiGroup() {
  const requestDefinition = (method: HttpMethod) => ({
    args: z.object({
      path: z
        .string()
        .describe("API path, for example /api/status/homebridge."),
    }),
    description: `${method} an arbitrary Homebridge API path.`,
    options: z.object({
      body: z.string().optional().describe("JSON request body."),
      file: z
        .string()
        .optional()
        .describe("File path to upload as multipart/form-data field `file`."),
      auth: z
        .boolean()
        .default(true)
        .describe("Send the saved bearer token. Use --no-auth to disable."),
      profile: z.string().optional().describe("Credential profile name."),
      query: z
        .string()
        .optional()
        .describe("JSON object converted to URL query parameters."),
      url: z
        .string()
        .url()
        .optional()
        .describe(
          "Homebridge UI base URL. Required with --no-auth if no profile exists.",
        ),
    }),
    async run(c: {
      args: { path: string };
      options: {
        body?: string;
        file?: string;
        auth: boolean;
        profile?: string;
        query?: string;
        url?: string;
      };
    }) {
      const client =
        !c.options.auth && c.options.url
          ? await createClient({
              profile: {
                token: "",
                url: c.options.url,
                savedAt: new Date().toISOString(),
              },
            })
          : await createClient({ profileName: c.options.profile });
      return client.request({
        authenticated: c.options.auth,
        body: parseJsonValue(c.options.body),
        file: c.options.file,
        method,
        path: c.args.path,
        query: parseJsonObject(c.options.query, "query"),
      });
    },
  });

  return Cli.create("api", {
    description: "Raw Homebridge API request commands",
  })
    .command("coverage", {
      description:
        "Compare the CLI operation table with a Homebridge /swagger-json document.",
      options: z.object({
        auth: z
          .boolean()
          .default(true)
          .describe("Use saved credentials. Use --no-auth with --url to skip."),
        profile: z.string().optional().describe("Credential profile name."),
        url: z
          .string()
          .url()
          .optional()
          .describe("Homebridge UI base URL. Required with --no-auth."),
      }),
      async run(c) {
        const profile = c.options.auth
          ? await getProfile({ name: c.options.profile })
          : undefined;
        const url = c.options.url ?? profile?.url;
        if (!url) {
          throw new Error(
            "No Homebridge URL available. Pass --url or login first.",
          );
        }
        const swaggerOperations = await fetchSwaggerOperations(url, {
          token: c.options.auth ? profile?.token : undefined,
        });
        const coverage = compareSwaggerCoverage(swaggerOperations);
        return {
          ...coverage,
          covered: coverage.missing.length === 0 && coverage.extra.length === 0,
        };
      },
    })
    .command("get", requestDefinition("GET"))
    .command("post", requestDefinition("POST"))
    .command("put", requestDefinition("PUT"))
    .command("patch", requestDefinition("PATCH"))
    .command("delete", requestDefinition("DELETE"));
}

function addPluginManagementCommands(group: ReturnType<typeof Cli.create>) {
  group
    .command("outdated", {
      description: "List installed plugins with available updates.",
      options: z.object({
        profile: z.string().optional().describe("Credential profile name."),
      }),
      async run(c) {
        const client = await createClient({ profileName: c.options.profile });
        return pluginUpdates(
          await client.request({ method: "GET", path: "/api/plugins" }),
        );
      },
    })
    .command("update", {
      args: z.object({
        pluginName: z.string().describe("Installed plugin package name."),
      }),
      description:
        "Update an installed plugin through the Homebridge plugin Socket.IO channel.",
      options: z.object({
        profile: z.string().optional().describe("Credential profile name."),
        termCols: z
          .number()
          .int()
          .positive()
          .default(120)
          .describe("Terminal column count sent to the Homebridge job."),
        termRows: z
          .number()
          .int()
          .positive()
          .default(30)
          .describe("Terminal row count sent to the Homebridge job."),
        version: z
          .string()
          .default("latest")
          .describe("Plugin version or dist-tag to install."),
      }),
      async *run(c) {
        const profile = await requireProfile(c.options.profile);
        yield {
          plugin: c.args.pluginName,
          status: "starting",
          version: c.options.version,
        };
        for await (const event of runPluginSocketAction(profile, {
          name: c.args.pluginName,
          termCols: c.options.termCols,
          termRows: c.options.termRows,
          version: c.options.version,
        })) {
          yield event;
        }
      },
    })
    .command("update-all", {
      description:
        "Update every installed plugin that reports updateAvailable through the Homebridge API.",
      options: z.object({
        profile: z.string().optional().describe("Credential profile name."),
        termCols: z
          .number()
          .int()
          .positive()
          .default(120)
          .describe("Terminal column count sent to Homebridge jobs."),
        termRows: z
          .number()
          .int()
          .positive()
          .default(30)
          .describe("Terminal row count sent to Homebridge jobs."),
      }),
      async *run(c) {
        const profile = await requireProfile(c.options.profile);
        const client = await createClient({ profile });
        const updates = pluginUpdates(
          await client.request({ method: "GET", path: "/api/plugins" }),
        );
        if (!updates.length) {
          yield { status: "noop", updates: [] };
          return;
        }
        for (const update of updates) {
          yield {
            latestVersion: update.latestVersion,
            plugin: update.name,
            previousVersion: update.installedVersion,
            status: "starting",
          };
          for await (const event of runPluginSocketAction(profile, {
            name: update.name,
            termCols: c.options.termCols,
            termRows: c.options.termRows,
            version: update.latestVersion ?? "latest",
          })) {
            yield { ...event, plugin: update.name };
          }
        }
        yield {
          plugins: updates.map((update) => update.name),
          status: "complete",
          updated: updates.length,
        };
      },
    });
}

type PluginListItem = {
  installedVersion?: string;
  latestVersion?: string;
  name?: string;
  updateAvailable?: boolean;
};

function pluginUpdates(response: unknown) {
  if (!Array.isArray(response)) {
    throw new Error("Expected /api/plugins to return an array.");
  }
  return response
    .filter(isPluginListItem)
    .filter((plugin) => plugin.updateAvailable === true)
    .map((plugin) => ({
      installedVersion: plugin.installedVersion,
      latestVersion: plugin.latestVersion,
      name: plugin.name,
    }));
}

function isPluginListItem(value: unknown): value is Required<PluginListItem> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    typeof record.installedVersion === "string" &&
    typeof record.latestVersion === "string" &&
    typeof record.updateAvailable === "boolean"
  );
}

async function requireProfile(profileName?: string) {
  const profile = await getProfile({ name: profileName });
  if (!profile) {
    throw new Error(
      "Not logged in. Run `homebridge auth login --url <url> --username <user> --password <pass>`.",
    );
  }
  return profile;
}

function responseToken(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;
  const record = response as Record<string, unknown>;
  return typeof record.access_token === "string"
    ? record.access_token
    : typeof record.accessToken === "string"
      ? record.accessToken
      : typeof record.token === "string"
        ? record.token
        : undefined;
}
