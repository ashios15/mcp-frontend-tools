import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBundleBudget } from "../src/tools/bundle-budget.js";
import { registerDesignTokenDiff } from "../src/tools/design-token-diff.js";
import { registerScaffoldComponent } from "../src/tools/scaffold-component.js";

async function makeServer() {
  const s = new McpServer({ name: "t", version: "0.0.0" }, { capabilities: { tools: {} } });
  registerBundleBudget(s);
  registerDesignTokenDiff(s);
  registerScaffoldComponent(s);
  return s;
}

/** Access the internal tool handlers directly via the registered callbacks. */
function getCallback(server: McpServer, name: string): (args: Record<string, unknown>) => Promise<unknown> {
  // @ts-expect-error touching internals for tests
  const registered = server._registeredTools as Record<string, { handler: (args: unknown) => Promise<unknown> }>;
  const entry = registered[name];
  if (!entry) throw new Error(`Tool not registered: ${name}`);
  return entry.handler as (args: Record<string, unknown>) => Promise<unknown>;
}

function parseText(res: unknown): unknown {
  const r = res as { content: Array<{ text: string }> };
  return JSON.parse(r.content[0]!.text);
}

describe("bundle_budget_check", () => {
  it("flags files over budget and passes when under", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bb-"));
    await fs.writeFile(path.join(dir, "small.js"), "a".repeat(1024));
    // Incompressible payload so gzip size is close to raw size.
    const { randomBytes } = await import("node:crypto");
    await fs.writeFile(path.join(dir, "big.js"), randomBytes(800 * 1024));
    const s = await makeServer();
    const cb = getCallback(s, "bundle_budget_check");
    const out = parseText(await cb({ buildDir: dir, budgetKb: 10 })) as {
      overBudgetCount: number;
      status: string;
      files: Array<{ file: string; over: boolean }>;
    };
    expect(out.overBudgetCount).toBeGreaterThanOrEqual(1);
    expect(out.status).toBe("fail");
    expect(out.files.find((f) => f.file === "big.js")?.over).toBe(true);
  });
});

describe("design_token_diff", () => {
  it("detects added, removed, and changed tokens", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dt-"));
    const before = {
      color: {
        primary: { $value: "#3366ff", $type: "color" },
        secondary: { $value: "#999999", $type: "color" },
      },
    };
    const after = {
      color: {
        primary: { $value: "#4477ff", $type: "color" },
        accent: { $value: "#ff00aa", $type: "color" },
      },
    };
    const beforePath = path.join(dir, "before.json");
    const afterPath = path.join(dir, "after.json");
    await fs.writeFile(beforePath, JSON.stringify(before));
    await fs.writeFile(afterPath, JSON.stringify(after));
    const s = await makeServer();
    const cb = getCallback(s, "design_token_diff");
    const out = parseText(await cb({ beforePath, afterPath })) as {
      summary: { added: number; removed: number; changed: number };
      changes: Array<{ path: string; kind: string; note?: string }>;
    };
    expect(out.summary.added).toBe(1);
    expect(out.summary.removed).toBe(1);
    expect(out.summary.changed).toBe(1);
    const changed = out.changes.find((c) => c.path === "color.primary")!;
    expect(changed.kind).toBe("changed");
    expect(changed.note).toContain("color change");
  });
});

describe("scaffold_react_component", () => {
  it("writes component + test + story files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sc-"));
    const s = await makeServer();
    const cb = getCallback(s, "scaffold_react_component");
    const out = parseText(await cb({ name: "Button", outDir: dir, variant: "forwardRef" })) as {
      written: string[];
    };
    expect(out.written).toHaveLength(3);
    const comp = await fs.readFile(path.join(dir, "Button.tsx"), "utf8");
    expect(comp).toContain("forwardRef");
    expect(comp).toContain("ButtonProps");
  });
});
