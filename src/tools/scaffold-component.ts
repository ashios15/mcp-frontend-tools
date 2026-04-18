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
