# mcp-frontend-tools

The reference **Model Context Protocol** server for frontend work. One install gives any coding agent — Claude Desktop, Cursor, VS Code, Zed, Continue — real *eyes and hands* on your UI:

- `axe_audit` — run the real [`axe-core`](https://github.com/dequelabs/axe-core) rule engine against raw HTML (via jsdom) or a live URL (via Playwright). Returns violations grouped by WCAG impact with fix links.
- `page_screenshot` — headless-Chromium PNGs of any URL or CSS selector, with viewport / DPR / color-scheme / `waitForSelector` controls.
- `bundle_budget_check` — walk a `dist/` directory, compute gzip (+ optional brotli) sizes, enforce a **global or per-entry KB budget**. CI-ready pass/fail JSON.
- `design_token_diff` — structural diff of two **W3C DTCG / Style Dictionary** token files. Reports added / removed / changed tokens with `$type`-aware notes.
- `storybook_story_run` — load a single Storybook story in headless Chromium via `iframe.html?id=…`, screenshot it, and run an axe audit against just the rendered component.
- `scaffold_react_component` — emit a typed React component (functional / `forwardRef` / polymorphic `as`) plus optional Vitest test and Storybook story.

All tools return structured JSON the model can reason over. No bespoke wrappers per editor.

---

## Install

```bash
npm i -g @ashios15/mcp-frontend-tools
# Optional — enables page_screenshot, storybook_story_run, and URL-mode axe_audit
npm i -g playwright
npx playwright install chromium
```

Node **≥ 20** is required. Without Playwright the server still starts; those three tools will return a clear "install playwright" error if called.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (or the Windows equivalent):

```json
{
  "mcpServers": {
    "frontend-tools": {
      "command": "mcp-frontend-tools"
    }
  }
}
```

### Cursor

Settings → MCP → Add new server:

```json
{
  "frontend-tools": { "command": "mcp-frontend-tools" }
}
```

### VS Code (GitHub Copilot agent mode)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "frontend-tools": { "command": "mcp-frontend-tools" }
  }
}
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector mcp-frontend-tools
```

---

## Tool reference

### `axe_audit`

```ts
{
  url?: string;        // require playwright
  html?: string;       // jsdom
  tags?: string[];     // default: wcag2a/aa + wcag21aa + wcag22aa + best-practice
  selector?: string;   // URL mode only
  timeoutMs?: number;  // default 15000
}
```

Returns violations and incomplete rules with `impact`, `help`, `helpUrl`, and up to 5 example failing nodes per rule.

### `page_screenshot`

```ts
{
  url: string;
  outPath: string;           // absolute; parent dirs auto-created
  selector?: string;
  fullPage?: boolean;
  width?: number;            // default 1280
  height?: number;           // default 800
  deviceScaleFactor?: number;// default 2
  colorScheme?: "light" | "dark" | "no-preference";
  waitForSelector?: string;
  timeoutMs?: number;
}
```

### `bundle_budget_check`

```ts
{
  buildDir: string;
  budgetKb?: number;                       // default 250 (gzipped)
  perEntryBudgetKb?: Record<string, number>;// key = path substring, longest match wins
  ext?: string[];                          // default [".js",".mjs",".cjs",".css"]
  includeBrotli?: boolean;
}
```

Returns every file with raw / gzip / brotli sizes, its applied budget, and `status: "pass" | "fail"`.

### `design_token_diff`

```ts
{
  beforePath: string;
  afterPath: string;
  ignoreKeys?: string[];
}
```

Understands the W3C DTCG shape (`$value`, `$type`). Group metadata keys starting with `$` are ignored. Color / dimension changes get annotated `note`s.

### `storybook_story_run`

```ts
{
  storybookUrl: string;      // e.g. http://localhost:6006
  storyId: string;           // e.g. components-button--primary
  screenshotPath?: string;
  runAxe?: boolean;          // default true
  viewport?: { width: number; height: number };
  colorScheme?: "light" | "dark" | "no-preference";
  timeoutMs?: number;
}
```

Loads `${storybookUrl}/iframe.html?viewMode=story&id=${storyId}`, waits for `#storybook-root`, and reports any page errors + axe violations scoped to the story.

### `scaffold_react_component`

```ts
{
  name: string;           // PascalCase
  outDir: string;         // absolute
  variant?: "functional" | "forwardRef" | "polymorphic";
  withTests?: boolean;    // default true
  withStory?: boolean;    // default true
  props?: Array<{ name: string; type: string; required?: boolean; defaultValue?: string }>;
}
```

---

## Why this over ad-hoc scripts?

- **Agents get typed contracts.** Every tool is a Zod-validated JSON Schema the model can introspect.
- **No local hallucination.** Axe violations come from the real axe-core engine, not a regex. Bundle sizes come from actual `zlib` compression, not estimates.
- **Composable.** `bundle_budget_check` failure → ask the agent to pull the largest file into `page_screenshot` → feed the image into a visual-regression step. All through MCP.
- **Stable surface.** Tools change behind a version bump; your `.vscode/mcp.json` doesn't.

## Development

```bash
git clone https://github.com/ashios15/mcp-frontend-tools.git
cd mcp-frontend-tools
npm install
npm run test       # 3 unit tests (bundle + tokens + scaffold)
npm run build
npm run inspector  # opens MCP Inspector against the built server
node scripts/smoke.mjs  # quick stdio tools/list check
```

## License

MIT © [ashios15](https://github.com/ashios15)
# mcp-frontend-tools

The reference **Model Context Protocol** server for frontend work. One install gives any coding agent — Claude Desktop, Cursor, VS Code, Zed, Continue — real *eyes and hands* on your UI:

- `axe_audit` — run the real [`axe-core`](https://github.com/dequelabs/axe-core) rule engine against raw HTML (via jsdom) or a live URL (via Playwright). Returns violations grouped by WCAG impact with fix links.
- `page_screenshot` — headless-Chromium PNGs of any URL or CSS selector, with viewport / DPR / color-scheme / `waitForSelector` controls.
- `bundle_budget_check` — walk a `dist/` directory, compute gzip (+ optional brotli) sizes, enforce a **global or per-entry KB budget**. CI-ready pass/fail JSON.
- `design_token_diff` — structural diff of two **W3C DTCG / Style Dictionary** token files. Reports added / removed / changed tokens with `$type`-aware notes.
- `storybook_story_run` — load a single Storybook story in headless Chromium via `iframe.html?id=…`, screenshot it, and run an axe audit against just the rendered component.
- `scaffold_react_component` — emit a typed React component (functional / `forwardRef` / polymorphic `as`) plus optional Vitest test and Storybook story.

All tools return structured JSON the model can reason over. No bespoke wrappers per editor.

---

## Install

```bash
npm i -g @ashishjoshi/mcp-frontend-tools
# Optional — enables page_screenshot, storybook_story_run, and URL-mode axe_audit
npm i -g playwright
npx playwright install chromium
```

Node **≥ 20** is required. Without Playwright the server still starts; those three tools will return a clear "install playwright" error if called.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (or the Windows equivalent):

```json
{
  "mcpServers": {
    "frontend-tools": {
      "command": "mcp-frontend-tools"
    }
  }
}
```

### Cursor

Settings → MCP → Add new server:

```json
{
  "frontend-tools": { "command": "mcp-frontend-tools" }
}
```

### VS Code (GitHub Copilot agent mode)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "frontend-tools": { "command": "mcp-frontend-tools" }
  }
}
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector mcp-frontend-tools
```

---

## Tool reference

### `axe_audit`

```ts
{
  url?: string;        // require playwright
  html?: string;       // jsdom
  tags?: string[];     // default: wcag2a/aa + wcag21aa + wcag22aa + best-practice
  selector?: string;   // URL mode only
  timeoutMs?: number;  // default 15000
}
```

Returns violations and incomplete rules with `impact`, `help`, `helpUrl`, and up to 5 example failing nodes per rule.

### `page_screenshot`

```ts
{
  url: string;
  outPath: string;           // absolute; parent dirs auto-created
  selector?: string;
  fullPage?: boolean;
  width?: number;            // default 1280
  height?: number;           // default 800
  deviceScaleFactor?: number;// default 2
  colorScheme?: "light" | "dark" | "no-preference";
  waitForSelector?: string;
  timeoutMs?: number;
}
```

### `bundle_budget_check`

```ts
{
  buildDir: string;
  budgetKb?: number;                       // default 250 (gzipped)
  perEntryBudgetKb?: Record<string, number>;// key = path substring, longest match wins
  ext?: string[];                          // default [".js",".mjs",".cjs",".css"]
  includeBrotli?: boolean;
}
```

Returns every file with raw / gzip / brotli sizes, its applied budget, and `status: "pass" | "fail"`.

### `design_token_diff`

```ts
{
  beforePath: string;
  afterPath: string;
  ignoreKeys?: string[];
}
```

Understands the W3C DTCG shape (`$value`, `$type`). Group metadata keys starting with `$` are ignored. Color / dimension changes get annotated `note`s.

### `storybook_story_run`

```ts
{
  storybookUrl: string;      // e.g. http://localhost:6006
  storyId: string;           // e.g. components-button--primary
  screenshotPath?: string;
  runAxe?: boolean;          // default true
  viewport?: { width: number; height: number };
  colorScheme?: "light" | "dark" | "no-preference";
  timeoutMs?: number;
}
```

Loads `${storybookUrl}/iframe.html?viewMode=story&id=${storyId}`, waits for `#storybook-root`, and reports any page errors + axe violations scoped to the story.

### `scaffold_react_component`

```ts
{
  name: string;           // PascalCase
  outDir: string;         // absolute
  variant?: "functional" | "forwardRef" | "polymorphic";
  withTests?: boolean;    // default true
  withStory?: boolean;    // default true
  props?: Array<{ name: string; type: string; required?: boolean; defaultValue?: string }>;
}
```

---

## Why this over ad-hoc scripts?

- **Agents get typed contracts.** Every tool is a Zod-validated JSON-Schema the model can introspect.
- **No local hallucination.** Axe violations come from the real axe-core engine, not a regex. Bundle sizes come from actual `zlib` compression, not estimates.
- **Composable.** `bundle_budget_check` failure → ask the agent to pull the largest file into `page_screenshot` → feed the image into a visual-regression step. All through MCP.
- **Stable surface.** Tools change behind a version bump; your `.vscode/mcp.json` doesn't.

## Development

```bash
npm install
npm run test       # 3 unit tests (bundle + tokens + scaffold)
npm run build
npm run inspector  # opens MCP Inspector against the built server
node scripts/smoke.mjs  # quick stdio tools/list check
```

## License

MIT © Ashish Joshi
# MCP Frontend Tools Server

A **Model Context Protocol (MCP)** server that gives AI assistants (Claude, Copilot, Cursor) access to frontend development tools — component scaffolding, bundle analysis, accessibility checks, and responsive design guides.

![MCP](https://img.shields.io/badge/MCP-1.0-8B5CF6)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)

## Available Tools

| Tool | Description |
|---|---|
| `scaffold_react_component` | Generate a typed React component with tests, stories, and CSS module |
| `analyze_bundle` | Scan a build directory for oversized JS/CSS, report findings |
| `check_accessibility` | Static WCAG 2.2 checks on HTML with fix suggestions |
| `responsive_breakpoint_guide` | Generate responsive CSS, container query, and Tailwind patterns |

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "frontend-tools": {
      "command": "node",
      "args": ["/path/to/mcp-frontend-tools/dist/index.js"]
    }
  }
}
```

### VS Code with Copilot

Add to `.vscode/settings.json`:

```json
{
  "github.copilot.chat.mcpServers": {
    "frontend-tools": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-frontend-tools/dist/index.js"]
    }
  }
}
```

## Example Usage (in AI Chat)

> "Scaffold a UserProfileCard component with avatar, name, and bio props"

The AI calls `scaffold_react_component` and gets back:
- `UserProfileCard.tsx` — Typed component with forwardRef
- `UserProfileCard.test.tsx` — Testing Library tests
- `UserProfileCard.stories.tsx` — Storybook story
- `UserProfileCard.module.css` — CSS module
- `index.ts` — Barrel export

> "Analyze my dist/ folder for bundle size issues"

The AI calls `analyze_bundle` and returns a markdown report with oversized files, recommendations, and a summary table.

## Architecture

```
src/
├── index.ts                  # MCP server setup (stdio transport)
└── tools/
    ├── index.ts              # Tool definitions + router
    ├── scaffold-component.ts # React component generator
    ├── bundle-analyzer.ts    # Build output analyzer
    ├── a11y-checker.ts       # Static WCAG checks
    └── responsive-guide.ts   # Responsive CSS pattern generator
```

## Development

```bash
npm install
npm run build
npm run inspector   # Test with MCP Inspector
```

## License

MIT
