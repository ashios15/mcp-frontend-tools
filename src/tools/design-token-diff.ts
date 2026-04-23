import { z } from "zod";
import { promises as fs } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult } from "../util/optional.js";

const InputShape = {
  beforePath: z.string().describe("Path to the baseline tokens JSON (Style Dictionary / W3C DTCG format)."),
  afterPath: z.string().describe("Path to the new tokens JSON."),
  ignoreKeys: z
    .array(z.string())
    .optional()
    .describe("Dot-path keys to ignore (e.g. ['$description','$extensions'])."),
};

type Json = unknown;

function isObject(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * A W3C design token has a `$value` (and usually `$type`). Otherwise it's a group.
 */
function isToken(v: Json): v is Record<string, Json> {
  return isObject(v) && Object.prototype.hasOwnProperty.call(v, "$value");
}

interface Change {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: Json;
  after?: Json;
  type?: string;
  note?: string;
}

function flatten(node: Json, prefix: string, acc: Map<string, Record<string, Json>>) {
  if (isToken(node)) {
    acc.set(prefix, node);
    return;
  }
  if (isObject(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue; // metadata like $description at group level
      flatten(v, prefix ? `${prefix}.${k}` : k, acc);
    }
  }
}

function classifyNote(type: string | undefined, before: Json, after: Json): string | undefined {
  if (!type) return undefined;
  if (type === "color" && typeof before === "string" && typeof after === "string") {
    return `color change: ${before} → ${after}`;
  }
  if ((type === "dimension" || type === "spacing") && typeof before === "string" && typeof after === "string") {
    return `dimension change: ${before} → ${after}`;
  }
  return undefined;
}

export function registerDesignTokenDiff(server: McpServer) {
  server.registerTool(
    "design_token_diff",
    {
      title: "Design Token Diff",
      description:
        "Diff two design-token JSON files (W3C DTCG / Style Dictionary style). Reports added, removed, and changed tokens with $type-aware classification. Useful for PR review of design-system changes.",
      inputSchema: InputShape,
    },
    async (args) => {
      try {
        const [beforeRaw, afterRaw] = await Promise.all([
          fs.readFile(args.beforePath, "utf8"),
          fs.readFile(args.afterPath, "utf8"),
        ]);
        const before = JSON.parse(beforeRaw);
        const after = JSON.parse(afterRaw);
        const beforeMap = new Map<string, Record<string, Json>>();
        const afterMap = new Map<string, Record<string, Json>>();
        flatten(before, "", beforeMap);
        flatten(after, "", afterMap);
        const ignore = new Set(args.ignoreKeys ?? []);
        const changes: Change[] = [];
        const allPaths = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
        for (const p of allPaths) {
          if (ignore.has(p)) continue;
          const b = beforeMap.get(p);
          const a = afterMap.get(p);
          if (!b && a) {
            changes.push({ path: p, kind: "added", after: a.$value, type: a.$type as string | undefined });
          } else if (b && !a) {
            changes.push({ path: p, kind: "removed", before: b.$value, type: b.$type as string | undefined });
          } else if (b && a) {
            const bv = JSON.stringify(b.$value);
            const av = JSON.stringify(a.$value);
            if (bv !== av) {
              const type = (a.$type ?? b.$type) as string | undefined;
              changes.push({
                path: p,
                kind: "changed",
                before: b.$value,
                after: a.$value,
                type,
                note: classifyNote(type, b.$value, a.$value),
              });
            }
          }
        }
        const byKind = { added: 0, removed: 0, changed: 0 };
        for (const c of changes) byKind[c.kind]++;
        changes.sort((x, y) => x.path.localeCompare(y.path));
        return jsonResult({
          beforePath: args.beforePath,
          afterPath: args.afterPath,
          tokenCount: { before: beforeMap.size, after: afterMap.size },
          summary: byKind,
          changes,
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
