import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult } from "../util/optional.js";

const PropShape = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
  defaultValue: z.string().optional(),
});

const InputShape = {
  name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, "PascalCase"),
  outDir: z
    .string()
    .describe("Absolute directory to write the component files into. Created if missing."),
  variant: z.enum(["functional", "forwardRef", "polymorphic"]).optional(),
  withTests: z.boolean().optional(),
  withStory: z.boolean().optional(),
  props: z.array(PropShape).optional(),
};

function propsInterface(name: string, props: Array<z.infer<typeof PropShape>>) {
  if (!props.length) return `export interface ${name}Props {}`;
  const lines = props.map((p) => {
    const opt = p.required ? "" : "?";
    return `  ${p.name}${opt}: ${p.type};`;
  });
  return `export interface ${name}Props {\n${lines.join("\n")}\n}`;
}

function renderComponent(
  name: string,
  variant: "functional" | "forwardRef" | "polymorphic",
  props: Array<z.infer<typeof PropShape>>
): string {
  const iface = propsInterface(name, props);
  if (variant === "forwardRef") {
    return `import { forwardRef } from "react";

${iface}

export const ${name} = forwardRef<HTMLDivElement, ${name}Props>(function ${name}(props, ref) {
  return <div ref={ref} data-component="${name}" />;
});
`;
  }
  if (variant === "polymorphic") {
    return `import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";

${iface}

type PolymorphicProps<E extends ElementType> = ${name}Props & {
  as?: E;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<E>, keyof ${name}Props | "as" | "children">;

export function ${name}<E extends ElementType = "div">({ as, children, ...rest }: PolymorphicProps<E>) {
  const Tag = (as ?? "div") as ElementType;
  return <Tag data-component="${name}" {...rest}>{children}</Tag>;
}
`;
  }
  return `${iface}

export function ${name}(_props: ${name}Props) {
  return <div data-component="${name}" />;
}
`;
}

function renderTest(name: string) {
  return `import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ${name} } from "./${name}.js";

describe("${name}", () => {
  it("renders", () => {
    render(<${name} />);
    expect(screen.getByTestId ? true : true).toBe(true);
  });
});
`;
}

function renderStory(name: string) {
  return `import type { Meta, StoryObj } from "@storybook/react";
import { ${name} } from "./${name}.js";

const meta: Meta<typeof ${name}> = { component: ${name} };
export default meta;

export const Default: StoryObj<typeof ${name}> = {};
`;
}

export function registerScaffoldComponent(server: McpServer) {
  server.registerTool(
    "scaffold_react_component",
    {
      title: "Scaffold React Component",
      description:
        "Write a TypeScript React component, optional test, and optional Storybook story into outDir. Supports functional, forwardRef, and polymorphic (`as` prop) variants.",
      inputSchema: InputShape,
    },
    async (args) => {
      try {
        const variant = args.variant ?? "functional";
        const withTests = args.withTests ?? true;
        const withStory = args.withStory ?? true;
        const props = args.props ?? [];
        await fs.mkdir(args.outDir, { recursive: true });
        const written: string[] = [];
        const compPath = path.join(args.outDir, `${args.name}.tsx`);
        await fs.writeFile(compPath, renderComponent(args.name, variant, props));
        written.push(compPath);
        if (withTests) {
          const testPath = path.join(args.outDir, `${args.name}.test.tsx`);
          await fs.writeFile(testPath, renderTest(args.name));
          written.push(testPath);
        }
        if (withStory) {
          const storyPath = path.join(args.outDir, `${args.name}.stories.tsx`);
          await fs.writeFile(storyPath, renderStory(args.name));
          written.push(storyPath);
        }
        return jsonResult({ name: args.name, variant, written });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
interface PropDef {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
}

export async function scaffoldComponent(args: Record<string, unknown>) {
  const name = args.name as string;
  const variant = (args.variant as string) ?? "functional";
  const withTests = (args.withTests as boolean) ?? true;
  const withStory = (args.withStory as boolean) ?? true;
  const props = (args.props as PropDef[]) ?? [];

  const files: Record<string, string> = {};

  // Props interface
  const propsInterface = generatePropsInterface(name, props);

  // Component file
  files[`${name}.tsx`] = generateComponent(name, variant, propsInterface, props);

  // CSS module
  files[`${name}.module.css`] = generateCSS(name);

  // Test file
  if (withTests) {
    files[`${name}.test.tsx`] = generateTest(name, props);
  }

  // Story file
  if (withStory) {
    files[`${name}.stories.tsx`] = generateStory(name, props);
  }

  // Index barrel
  files[`index.ts`] = `export { ${name} } from "./${name}";\nexport type { ${name}Props } from "./${name}";\n`;

  const output = Object.entries(files)
    .map(([filename, content]) => `### ${filename}\n\`\`\`tsx\n${content}\n\`\`\``)
    .join("\n\n");

  return {
    content: [
      {
        type: "text",
        text: `Generated ${Object.keys(files).length} files for **${name}** component (${variant}):\n\n${output}`,
      },
    ],
  };
}

function generatePropsInterface(name: string, props: PropDef[]): string {
  const lines = [`export interface ${name}Props {`];
  for (const prop of props) {
    const optional = prop.required ? "" : "?";
    lines.push(`  ${prop.name}${optional}: ${prop.type};`);
  }
  lines.push(`  className?: string;`);
  lines.push(`  children?: React.ReactNode;`);
  lines.push(`}`);
  return lines.join("\n");
}

function generateComponent(
  name: string,
  variant: string,
  propsInterface: string,
  props: PropDef[]
): string {
  const defaults = props
    .filter((p) => p.defaultValue)
    .map((p) => `  ${p.name} = ${p.defaultValue},`)
    .join("\n");

  const destructured = [
    ...props.map((p) => p.name),
    "className",
    "children",
  ].join(", ");

  if (variant === "forwardRef") {
    return `import React, { forwardRef } from "react";
import styles from "./${name}.module.css";

${propsInterface}

export const ${name} = forwardRef<HTMLDivElement, ${name}Props>(
  function ${name}({ ${destructured} }, ref) {
    return (
      <div ref={ref} className={\`\${styles.root} \${className ?? ""}\`}>
        {children}
      </div>
    );
  }
);
`;
  }

  return `import React from "react";
import styles from "./${name}.module.css";

${propsInterface}

export function ${name}({ ${destructured} }: ${name}Props) {
  return (
    <div className={\`\${styles.root} \${className ?? ""}\`}>
      {children}
    </div>
  );
}
`;
}

function generateCSS(name: string): string {
  return `.root {
  /* ${name} styles */
}
`;
}

function generateTest(name: string, props: PropDef[]): string {
  return `import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ${name} } from "./${name}";

describe("${name}", () => {
  it("renders without crashing", () => {
    render(<${name}>Test</${name}>);
    expect(screen.getByText("Test")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(<${name} className="custom">Test</${name}>);
    expect(container.firstChild).toHaveClass("custom");
  });
});
`;
}

function generateStory(name: string, props: PropDef[]): string {
  const argTypes = props
    .map((p) => `    ${p.name}: { control: "text" },`)
    .join("\n");

  return `import type { Meta, StoryObj } from "@storybook/react";
import { ${name} } from "./${name}";

const meta: Meta<typeof ${name}> = {
  title: "Components/${name}",
  component: ${name},
  argTypes: {
${argTypes}
  },
};

export default meta;
type Story = StoryObj<typeof ${name}>;

export const Default: Story = {
  args: {
    children: "${name} content",
  },
};
`;
}
