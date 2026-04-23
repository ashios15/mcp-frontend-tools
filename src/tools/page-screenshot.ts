import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, loadOptional } from "../util/optional.js";

const InputShape = {
  url: z.string().url().describe("URL to screenshot."),
  outPath: z
    .string()
    .describe("Absolute file path to write PNG to. Parent dirs will be created."),
  selector: z
    .string()
    .optional()
    .describe("CSS selector to screenshot instead of the viewport."),
  fullPage: z.boolean().optional().describe("Capture the full scrollable page (default: false)."),
  width: z.number().int().positive().optional().describe("Viewport width (default 1280)."),
  height: z.number().int().positive().optional().describe("Viewport height (default 800)."),
  deviceScaleFactor: z.number().positive().optional().describe("DPR (default 2)."),
  colorScheme: z.enum(["light", "dark", "no-preference"]).optional(),
  waitForSelector: z.string().optional().describe("Wait for this selector before capturing."),
  timeoutMs: z.number().int().positive().optional(),
};

export function registerPageScreenshot(server: McpServer) {
  server.registerTool(
    "page_screenshot",
    {
      title: "Page Screenshot (Playwright)",
      description:
        "Launch headless Chromium, navigate to a URL, and save a PNG screenshot. Supports element selectors, full-page capture, dark mode, and custom viewports. Requires the optional `playwright` peer dependency.",
      inputSchema: InputShape,
    },
    async (args) => {
      try {
        const pw = await loadOptional<typeof import("playwright")>(
          "playwright",
          "npm i -D playwright && npx playwright install chromium"
        );
        const browser = await pw.chromium.launch();
        try {
          const context = await browser.newContext({
            viewport: {
              width: args.width ?? 1280,
              height: args.height ?? 800,
            },
            deviceScaleFactor: args.deviceScaleFactor ?? 2,
            colorScheme: args.colorScheme ?? "light",
          });
          const page = await context.newPage();
          const timeout = args.timeoutMs ?? 20000;
          await page.goto(args.url, { waitUntil: "networkidle", timeout });
          if (args.waitForSelector) {
            await page.waitForSelector(args.waitForSelector, { timeout });
          }
          await fs.mkdir(path.dirname(args.outPath), { recursive: true });
          if (args.selector) {
            const el = await page.$(args.selector);
            if (!el) return errorResult(`Selector not found: ${args.selector}`);
            await el.screenshot({ path: args.outPath });
          } else {
            await page.screenshot({
              path: args.outPath,
              fullPage: args.fullPage ?? false,
            });
          }
          const stat = await fs.stat(args.outPath);
          return jsonResult({
            url: args.url,
            outPath: args.outPath,
            bytes: stat.size,
            viewport: {
              width: args.width ?? 1280,
              height: args.height ?? 800,
              deviceScaleFactor: args.deviceScaleFactor ?? 2,
            },
            colorScheme: args.colorScheme ?? "light",
            fullPage: args.fullPage ?? false,
            selector: args.selector ?? null,
          });
        } finally {
          await browser.close();
        }
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
