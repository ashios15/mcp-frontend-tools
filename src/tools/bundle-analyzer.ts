import fs from "node:fs";
import path from "node:path";

export async function analyzeBundle(args: Record<string, unknown>) {
  const buildDir = args.buildDir as string;
  const budgetKb = (args.budgetKb as number) ?? 250;

  if (!fs.existsSync(buildDir)) {
    return {
      content: [{ type: "text", text: `Build directory not found: ${buildDir}` }],
    };
  }

  const files = getAllFiles(buildDir);
  const jsFiles = files.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  const cssFiles = files.filter((f) => f.endsWith(".css"));

  const analysis: string[] = ["# Bundle Analysis Report\n"];

  // JS files sorted by size
  const jsSizes = jsFiles.map((f) => ({
    name: path.relative(buildDir, f),
    sizeKb: Math.round(fs.statSync(f).size / 1024),
  }));
  jsSizes.sort((a, b) => b.sizeKb - a.sizeKb);

  const totalJsKb = jsSizes.reduce((sum, f) => sum + f.sizeKb, 0);
  const totalCssKb = cssFiles.reduce(
    (sum, f) => sum + Math.round(fs.statSync(f).size / 1024),
    0
  );

  analysis.push(`## Summary`);
  analysis.push(`- **Total JS:** ${totalJsKb} KB (${jsSizes.length} files)`);
  analysis.push(`- **Total CSS:** ${totalCssKb} KB (${cssFiles.length} files)`);
  analysis.push(`- **Budget:** ${budgetKb} KB per file\n`);

  // Flag oversized files
  const oversized = jsSizes.filter((f) => f.sizeKb > budgetKb);
  if (oversized.length > 0) {
    analysis.push(`## ⚠️ Files Over Budget (${budgetKb} KB)`);
    for (const f of oversized) {
      analysis.push(`- **${f.name}**: ${f.sizeKb} KB (${f.sizeKb - budgetKb} KB over)`);
    }
    analysis.push("");
  }

  // Top files table
  analysis.push(`## Largest Files`);
  analysis.push(`| File | Size |`);
  analysis.push(`|---|---|`);
  for (const f of jsSizes.slice(0, 10)) {
    const flag = f.sizeKb > budgetKb ? " ⚠️" : "";
    analysis.push(`| ${f.name} | ${f.sizeKb} KB${flag} |`);
  }

  // Recommendations
  analysis.push(`\n## Recommendations`);
  if (oversized.length > 0) {
    analysis.push(
      `- Consider **code splitting** the ${oversized.length} oversized file(s) using dynamic imports`
    );
    analysis.push(`- Check for **duplicate dependencies** with \`npx depcheck\``);
  }
  if (totalJsKb > 500) {
    analysis.push(`- Total JS (${totalJsKb} KB) is high — review for tree-shaking opportunities`);
  }
  analysis.push(`- Run \`npx source-map-explorer\` on production builds for deeper analysis`);

  return {
    content: [{ type: "text", text: analysis.join("\n") }],
  };
}

function getAllFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
