import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axeSource from "axe-core";
import { errorResult, jsonResult, loadOptional } from "../util/optional.js";

const InputShape = {
  storybookUrl: z
    .string()
    .url()
    .describe("Base URL of a running Storybook, e.g. http://localhost:6006."),
  storyId: z
    .string()
    .describe("Story id as it appears in the URL (e.g. 'components-button--primary')."),
  screenshotPath: z
    .string()
    .optional()
    .describe("If set, save a PNG of the rendered story to this absolute path."),
  runAxe: z.boolean().optional().describe("Run an axe-core audit of the rendered story (default true)."),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  colorScheme: z.enum(["light", "dark", "no-preference"]).optional(),
  timeoutMs: z.number().int().positive().optional(),
};

export function registerStorybookStoryRun(server: McpServer) {
  server.registerTool(
    "storybook_story_run",
    {
      title: "Storybook Story Run",
      description:
        "Load a single Storybook story in headless Chromium via iframe.html, optionally screenshot it, and run an axe-core audit against the rendered output. Requires `playwright`.",
      inputSchema: InputShape,
    },
    async (args) => {
      try {
        const pw = await loadOptional<typeof import("playwright")>(
          "playwright",
          "npm i -D playwright && npx playwright install chromium"
        );
        const runAxe = args.runAxe ?? true;
        const timeout = args.timeoutMs ?? 20000;
        const base = args.storybookUrl.replace(/\/+$/, "");
        const iframeUrl = `${base}/iframe.html?viewMode=story&id=${encodeURIComponent(args.storyId)}`;
        const browser = await pw.chromium.launch();
        try {
          const context = await browser.newContext({
            viewport: args.viewport ?? { width: 1280, height: 800 },
            colorScheme: args.colorScheme ?? "light",
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (e: Error) => errors.push(e.message));
          await page.goto(iframeUrl, { waitUntil: "networkidle", timeout });
          // Storybook renders inside #storybook-root (newer) or #root (older)
          await page
            .waitForSelector("#storybook-root, #root", { timeout })
            .catch(() => {});
          const result: Record<string, unknown> = {
            storyId: args.storyId,
            iframeUrl,
            pageErrors: errors,
          };
          if (args.screenshotPath) {
            await fs.mkdir(path.dirname(args.screenshotPath), { recursive: true });
            await page.screenshot({ path: args.screenshotPath, fullPage: false });
            result.screenshotPath = args.screenshotPath;
          }
          if (runAxe) {
            await page.addScriptTag({ content: axeSource.source });
            const axeResults = await page.evaluate(async () => {
              // @ts-expect-error axe injected
              const axe = window.axe;
              const res = await axe.run(
                document.querySelector("#storybook-root, #root") ?? document,
                {
                  runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"],
                  },
                  resultTypes: ["violations", "incomplete"],
                }
              );
              return res;
            });
            const r = axeResults as {
              violations: Array<{
                id: string;
                impact: string | null;
                help: string;
                helpUrl: string;
                nodes: Array<{ target: string[]; html: string; failureSummary?: string }>;
              }>;
              incomplete: Array<{ id: string; help: string; nodes: unknown[] }>;
            };
            result.axe = {
              violationCount: r.violations.length,
              violations: r.violations.map((v) => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                helpUrl: v.helpUrl,
                nodes: v.nodes.slice(0, 3).map((n) => ({
                  target: n.target,
                  html: n.html.slice(0, 300),
                  failureSummary: n.failureSummary,
                })),
                nodeCount: v.nodes.length,
              })),
              incompleteCount: r.incomplete.length,
            };
          }
          return jsonResult(result);
        } finally {
          await browser.close();
        }
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
