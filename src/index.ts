#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAxeAudit } from "./tools/axe-audit.js";
import { registerPageScreenshot } from "./tools/page-screenshot.js";
import { registerBundleBudget } from "./tools/bundle-budget.js";
import { registerDesignTokenDiff } from "./tools/design-token-diff.js";
import { registerStorybookStoryRun } from "./tools/storybook-story-run.js";
import { registerScaffoldComponent } from "./tools/scaffold-component.js";

async function main() {
  const server = new McpServer(
    {
      name: "mcp-frontend-tools",
      version: "2.0.0",
    },
    {
      capabilities: { tools: {} },
      instructions:
        "Frontend engineering toolbox: run real axe-core accessibility audits, take Playwright screenshots, enforce bundle budgets, diff design tokens, and execute Storybook stories headlessly. Use these before opening a PR that touches UI.",
    }
  );

  registerAxeAudit(server);
  registerPageScreenshot(server);
  registerBundleBudget(server);
  registerDesignTokenDiff(server);
  registerStorybookStoryRun(server);
  registerScaffoldComponent(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stay alive until transport closes
  process.stdin.resume();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[mcp-frontend-tools] fatal:", err);
  process.exit(1);
});
