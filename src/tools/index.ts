import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { scaffoldComponent } from "./scaffold-component.js";
import { analyzeBundle } from "./bundle-analyzer.js";
import { checkAccessibility } from "./a11y-checker.js";
import { generateResponsiveGuide } from "./responsive-guide.js";

export const tools: Tool[] = [
  {
    name: "scaffold_react_component",
    description:
      "Generate a fully typed React component with props interface, tests, stories, and CSS module. Follows team conventions for file structure.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Component name in PascalCase, e.g. 'UserProfileCard'",
        },
        variant: {
          type: "string",
          enum: ["functional", "forwardRef", "polymorphic"],
          description: "Component pattern to use",
        },
        withTests: {
          type: "boolean",
          description: "Generate a test file (default: true)",
        },
        withStory: {
          type: "boolean",
          description: "Generate a Storybook story (default: true)",
        },
        props: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              required: { type: "boolean" },
              defaultValue: { type: "string" },
            },
            required: ["name", "type"],
          },
          description: "Props to include in the component interface",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "analyze_bundle",
    description:
      "Analyze a webpack/vite bundle output directory to find large dependencies, duplicate packages, and tree-shaking opportunities.",
    inputSchema: {
      type: "object" as const,
      properties: {
        buildDir: {
          type: "string",
          description: "Path to the build output directory (e.g. 'dist', '.next')",
        },
        budgetKb: {
          type: "number",
          description: "Bundle size budget in KB — flags files over this limit (default: 250)",
        },
      },
      required: ["buildDir"],
    },
  },
  {
    name: "check_accessibility",
    description:
      "Check an HTML file or snippet against WCAG 2.2 AA guidelines. Returns violations grouped by impact level with fix suggestions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        html: {
          type: "string",
          description: "HTML content to audit",
        },
        level: {
          type: "string",
          enum: ["A", "AA", "AAA"],
          description: "WCAG conformance level (default: AA)",
        },
      },
      required: ["html"],
    },
  },
  {
    name: "responsive_breakpoint_guide",
    description:
      "Generate a responsive design implementation guide with breakpoints, container queries, and fluid typography recommendations for a given component.",
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description: "Name of the component to generate responsive guide for",
        },
        breakpoints: {
          type: "array",
          items: { type: "string" },
          description: "Custom breakpoints (default: ['sm:640px', 'md:768px', 'lg:1024px', 'xl:1280px'])",
        },
        useContainerQueries: {
          type: "boolean",
          description: "Include CSS container query examples (default: true)",
        },
      },
      required: ["componentName"],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ content: Array<{ type: string; text: string }> }> {
  switch (name) {
    case "scaffold_react_component":
      return scaffoldComponent(args);
    case "analyze_bundle":
      return analyzeBundle(args);
    case "check_accessibility":
      return checkAccessibility(args);
    case "responsive_breakpoint_guide":
      return generateResponsiveGuide(args);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
      };
  }
}
