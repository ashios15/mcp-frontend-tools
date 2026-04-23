import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axeSource from "axe-core";
import { errorResult, jsonResult, loadOptional } from "../util/optional.js";

const InputShape = {
  url: z
    .string()
    .url()
    .optional()
    .describe("Fully qualified URL to audit. Requires playwright installed."),
  html: z
    .string()
    .optional()
    .describe("Raw HTML string to audit (jsdom, no JS execution)."),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      "axe rule tags to include. Defaults to ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']."
    ),
  selector: z
    .string()
    .optional()
    .describe("CSS selector to scope the audit (URL mode only)."),
  timeoutMs: z.number().int().positive().optional().describe("Default 15000."),
};

const DEFAULT_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary?: string;
  }>;
}

interface AxeResults {
  violations: AxeViolation[];
  passes: Array<{ id: string }>;
  incomplete: AxeViolation[];
  url?: string;
  timestamp: string;
}

function summarize(results: AxeResults, mode: "url" | "html", target: string) {
  const byImpact: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    unknown: 0,
  };
  for (const v of results.violations) {
    const k = v.impact ?? "unknown";
    byImpact[k] = (byImpact[k] ?? 0) + 1;
  }
  const totalNodes = results.violations.reduce((n, v) => n + v.nodes.length, 0);
  return {
    mode,
    target,
    summary: {
      violationRules: results.violations.length,
      violatingNodes: totalNodes,
      passedRules: results.passes.length,
      incompleteRules: results.incomplete.length,
      byImpact,
    },
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.slice(0, 5).map((n) => ({
        target: n.target,
        html: n.html.slice(0, 400),
        failureSummary: n.failureSummary,
      })),
      nodeCount: v.nodes.length,
    })),
    incomplete: results.incomplete.map((v) => ({
      id: v.id,
      help: v.help,
      nodeCount: v.nodes.length,
    })),
  };
}

async function auditHtml(html: string, tags: string[]): Promise<AxeResults> {
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const virtualConsole = new VirtualConsole(); // swallow page console noise
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  // Inject axe into the jsdom window
  const script = window.document.createElement("script");
  script.textContent = axeSource.source;
  window.document.head.appendChild(script);
  try {
    const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
    const results = await axe.run(window.document as unknown as Element, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations", "passes", "incomplete"],
    });
    return results as unknown as AxeResults;
  } finally {
    window.close();
  }
}

async function auditUrl(
  url: string,
  tags: string[],
  selector: string | undefined,
  timeoutMs: number
): Promise<AxeResults> {
  const pw = await loadOptional<typeof import("playwright")>(
    "playwright",
    "npm i -D playwright && npx playwright install chromium"
  );
  const browser = await pw.chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    await page.addScriptTag({ content: axeSource.source });
    const payload: { tags: string[]; selector: string | undefined } = { tags, selector };
    const results = (await page.evaluate(
      async (p: { tags: string[]; selector: string | undefined }) => {
        // @ts-expect-error axe injected
        const axe = window.axe;
        const context = p.selector ? { include: [[p.selector]] } : undefined;
        return await axe.run(context, {
          runOnly: { type: "tag", values: p.tags },
          resultTypes: ["violations", "passes", "incomplete"],
        });
      },
      payload
    )) as AxeResults;
    return results;
  } finally {
    await browser.close();
  }
}

export function registerAxeAudit(server: McpServer) {
  server.registerTool(
    "axe_audit",
    {
      title: "axe-core Accessibility Audit",
      description:
        "Run the axe-core accessibility ruleset against an HTML string (jsdom) or a live URL (Playwright). Returns violations grouped by impact with fix guidance and helpUrl links.",
      inputSchema: InputShape,
    },
    async (args) => {
      const tags = args.tags && args.tags.length ? args.tags : DEFAULT_TAGS;
      const timeoutMs = args.timeoutMs ?? 15000;
      if (!args.url && !args.html) {
        return errorResult("Provide either `url` or `html`.");
      }
      try {
        if (args.url) {
          const res = await auditUrl(args.url, tags, args.selector, timeoutMs);
          return jsonResult(summarize(res, "url", args.url));
        }
        const res = await auditHtml(args.html!, tags);
        return jsonResult(summarize(res, "html", `<${args.html!.length} chars>`));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
