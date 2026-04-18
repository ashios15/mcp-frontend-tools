export async function generateResponsiveGuide(args: Record<string, unknown>) {
  const componentName = args.componentName as string;
  const breakpoints = (args.breakpoints as string[]) ?? [
    "sm:640px",
    "md:768px",
    "lg:1024px",
    "xl:1280px",
  ];
  const useContainerQueries = (args.useContainerQueries as boolean) ?? true;

  const bpMap = breakpoints.map((bp) => {
    const [name, size] = bp.split(":");
    return { name, size };
  });

  const lines = [`# Responsive Guide for ${componentName}\n`];

  // Breakpoint table
  lines.push("## Breakpoints\n");
  lines.push("| Name | Min-width | Tailwind |");
  lines.push("|---|---|---|");
  for (const bp of bpMap) {
    lines.push(`| ${bp.name} | ${bp.size} | \`${bp.name}:\` |`);
  }

  // CSS media queries
  lines.push("\n## Media Query Pattern\n");
  lines.push("```css");
  lines.push(`.${componentName.toLowerCase()} {`);
  lines.push("  /* Mobile-first base styles */");
  lines.push("  display: flex;");
  lines.push("  flex-direction: column;");
  lines.push("  gap: 1rem;");
  lines.push("  padding: 1rem;");
  lines.push("}\n");

  for (const bp of bpMap) {
    lines.push(`@media (min-width: ${bp.size}) {`);
    lines.push(`  .${componentName.toLowerCase()} {`);
    if (bp.name === "md") {
      lines.push("    flex-direction: row;");
      lines.push("    gap: 1.5rem;");
    } else if (bp.name === "lg") {
      lines.push("    max-width: 1024px;");
      lines.push("    margin: 0 auto;");
      lines.push("    padding: 2rem;");
    }
    lines.push("  }");
    lines.push("}\n");
  }
  lines.push("```");

  // Container queries
  if (useContainerQueries) {
    lines.push("\n## Container Query Pattern\n");
    lines.push("```css");
    lines.push(`.${componentName.toLowerCase()}-wrapper {`);
    lines.push("  container-type: inline-size;");
    lines.push(`  container-name: ${componentName.toLowerCase()};`);
    lines.push("}\n");
    lines.push(
      `@container ${componentName.toLowerCase()} (min-width: 480px) {`
    );
    lines.push(`  .${componentName.toLowerCase()} {`);
    lines.push("    flex-direction: row;");
    lines.push("  }");
    lines.push("}\n");
    lines.push(
      `@container ${componentName.toLowerCase()} (min-width: 768px) {`
    );
    lines.push(`  .${componentName.toLowerCase()} {`);
    lines.push("    grid-template-columns: repeat(3, 1fr);");
    lines.push("  }");
    lines.push("}");
    lines.push("```");
  }

  // Fluid typography
  lines.push("\n## Fluid Typography\n");
  lines.push("```css");
  lines.push(`.${componentName.toLowerCase()}__title {`);
  lines.push("  /* clamp(min, preferred, max) */");
  lines.push("  font-size: clamp(1.25rem, 2vw + 0.5rem, 2rem);");
  lines.push("  line-height: 1.2;");
  lines.push("}");
  lines.push("```");

  // Tailwind version
  lines.push("\n## Tailwind CSS Implementation\n");
  lines.push("```tsx");
  lines.push(`function ${componentName}() {`);
  lines.push("  return (");
  lines.push("    <div className={`");
  lines.push("      flex flex-col gap-4 p-4");
  lines.push("      md:flex-row md:gap-6");
  lines.push("      lg:max-w-5xl lg:mx-auto lg:p-8");
  lines.push("    `}>");
  lines.push("      {/* content */}");
  lines.push("    </div>");
  lines.push("  );");
  lines.push("}");
  lines.push("```");

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
