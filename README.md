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
