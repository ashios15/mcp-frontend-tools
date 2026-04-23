import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult } from "../util/optional.js";

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

const InputShape = {
  buildDir: z.string().describe("Absolute path to the build output directory (e.g. dist, .next/static)."),
  budgetKb: z
    .number()
    .positive()
    .optional()
    .describe("Global size budget in KB. Flags any file above this (gzipped). Default: 250."),
  perEntryBudgetKb: z
    .record(z.number().positive())
    .optional()
    .describe(
      "Per-file budgets in KB keyed by glob-ish substring match. Matching file is checked against the most specific (longest) matching key."
    ),
  ext: z
    .array(z.string())
    .optional()
    .describe("File extensions to include (default: ['.js','.mjs','.cjs','.css'])."),
  includeBrotli: z.boolean().optional().describe("Also compute brotli sizes (slower)."),
};

const DEFAULT_EXT = [".js", ".mjs", ".cjs", ".css"];

async function walk(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  async function visit(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await visit(full);
      else if (exts.includes(path.extname(e.name))) out.push(full);
    }
  }
  await visit(dir);
  return out;
}

function matchBudget(
  relPath: string,
  perEntry: Record<string, number> | undefined
): { key: string; budgetKb: number } | null {
  if (!perEntry) return null;
  let best: { key: string; budgetKb: number } | null = null;
  for (const [key, budget] of Object.entries(perEntry)) {
    if (relPath.includes(key)) {
      if (!best || key.length > best.key.length) best = { key, budgetKb: budget };
    }
  }
  return best;
}

export function registerBundleBudget(server: McpServer) {
  server.registerTool(
    "bundle_budget_check",
    {
      title: "Bundle Budget Check",
      description:
        "Walk a build directory, measure raw + gzip (+ optional brotli) sizes per file, and flag files that exceed a global or per-entry KB budget. CI-friendly JSON output.",
      inputSchema: InputShape,
    },
    async (args) => {
      try {
        const exts = args.ext && args.ext.length ? args.ext : DEFAULT_EXT;
        const budgetKb = args.budgetKb ?? 250;
        const stat = await fs.stat(args.buildDir).catch(() => null);
        if (!stat || !stat.isDirectory()) {
          return errorResult(`buildDir not a directory: ${args.buildDir}`);
        }
        const files = await walk(args.buildDir, exts);
        const report = [];
        let overCount = 0;
        let totalRaw = 0;
        let totalGzip = 0;
        for (const f of files) {
          const buf = await fs.readFile(f);
          const gz = await gzip(buf);
          const br = args.includeBrotli ? await brotli(buf) : undefined;
          const rel = path.relative(args.buildDir, f);
          const match = matchBudget(rel, args.perEntryBudgetKb);
          const effectiveBudget = match?.budgetKb ?? budgetKb;
          const gzKb = gz.length / 1024;
          const over = gzKb > effectiveBudget;
          if (over) overCount++;
          totalRaw += buf.length;
          totalGzip += gz.length;
          report.push({
            file: rel,
            rawBytes: buf.length,
            rawKb: +(buf.length / 1024).toFixed(2),
            gzipBytes: gz.length,
            gzipKb: +gzKb.toFixed(2),
            ...(br ? { brotliBytes: br.length, brotliKb: +(br.length / 1024).toFixed(2) } : {}),
            budgetKb: effectiveBudget,
            budgetKey: match?.key ?? "(global)",
            over,
            overBy: over ? +(gzKb - effectiveBudget).toFixed(2) : 0,
          });
        }
        report.sort((a, b) => b.gzipBytes - a.gzipBytes);
        return jsonResult({
          buildDir: args.buildDir,
          fileCount: files.length,
          overBudgetCount: overCount,
          totals: {
            rawKb: +(totalRaw / 1024).toFixed(2),
            gzipKb: +(totalGzip / 1024).toFixed(2),
          },
          files: report,
          status: overCount === 0 ? "pass" : "fail",
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
