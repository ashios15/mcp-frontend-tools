export async function checkAccessibility(args: Record<string, unknown>) {
  const html = args.html as string;
  const level = (args.level as string) ?? "AA";

  const issues: Array<{
    impact: string;
    rule: string;
    description: string;
    fix: string;
    element: string;
  }> = [];

  // Static checks (subset of common WCAG rules)
  // In production, this would use axe-core or pa11y

  // Check for missing alt on images
  const imgRegex = /<img\b([^>]*)>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const attrs = match[1];
    if (!attrs.includes("alt=") && !attrs.includes("alt =")) {
      issues.push({
        impact: "critical",
        rule: "image-alt",
        description: "Images must have alternate text (WCAG 1.1.1)",
        fix: 'Add an alt attribute: alt="Description of image"',
        element: match[0],
      });
    }
  }

  // Check for missing form labels
  const inputRegex = /<input\b([^>]*)>/gi;
  while ((match = inputRegex.exec(html)) !== null) {
    const attrs = match[1];
    if (
      !attrs.includes("aria-label") &&
      !attrs.includes("aria-labelledby") &&
      !attrs.includes("id=")
    ) {
      issues.push({
        impact: "serious",
        rule: "label",
        description: "Form elements must have labels (WCAG 1.3.1)",
        fix: 'Add aria-label="..." or associate a <label> element',
        element: match[0],
      });
    }
  }

  // Check for empty buttons
  const buttonRegex = /<button\b([^>]*)>\s*<\/button>/gi;
  while ((match = buttonRegex.exec(html)) !== null) {
    const attrs = match[1];
    if (!attrs.includes("aria-label")) {
      issues.push({
        impact: "critical",
        rule: "button-name",
        description: "Buttons must have discernible text (WCAG 4.1.2)",
        fix: "Add text content or aria-label to the button",
        element: match[0],
      });
    }
  }

  // Check for missing lang on html
  if (html.includes("<html") && !html.includes("lang=")) {
    issues.push({
      impact: "serious",
      rule: "html-has-lang",
      description: "HTML element must have a lang attribute (WCAG 3.1.1)",
      fix: '<html lang="en">',
      element: "<html>",
    });
  }

  // Check for missing heading hierarchy
  const headingRegex = /<h([1-6])\b/gi;
  const headingLevels: number[] = [];
  while ((match = headingRegex.exec(html)) !== null) {
    headingLevels.push(parseInt(match[1]));
  }
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      issues.push({
        impact: "moderate",
        rule: "heading-order",
        description: `Heading levels should increase by one — found h${headingLevels[i - 1]} followed by h${headingLevels[i]} (WCAG 1.3.1)`,
        fix: `Use h${headingLevels[i - 1] + 1} instead of h${headingLevels[i]}`,
        element: `<h${headingLevels[i]}>`,
      });
    }
  }

  // Build report
  const lines = [`# Accessibility Check (WCAG ${level})\n`];
  lines.push(`Found **${issues.length}** issue(s)\n`);

  if (issues.length === 0) {
    lines.push("No issues detected in static analysis. Run axe-core for a comprehensive audit.");
  }

  const byImpact = { critical: [] as typeof issues, serious: [] as typeof issues, moderate: [] as typeof issues, minor: [] as typeof issues };
  for (const issue of issues) {
    const key = issue.impact as keyof typeof byImpact;
    if (byImpact[key]) byImpact[key].push(issue);
  }

  for (const [impact, items] of Object.entries(byImpact)) {
    if (items.length === 0) continue;
    lines.push(`## ${impact.toUpperCase()} (${items.length})`);
    for (const item of items) {
      lines.push(`\n### ${item.rule}`);
      lines.push(`${item.description}`);
      lines.push(`- **Element:** \`${item.element}\``);
      lines.push(`- **Fix:** ${item.fix}`);
    }
    lines.push("");
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
