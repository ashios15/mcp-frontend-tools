/**
 * Dynamically import an optional peer dependency. Throws a helpful, agent-readable
 * error if the module isn't installed so the MCP client can surface remediation steps.
 */
export async function loadOptional<T>(
  moduleName: string,
  install: string
): Promise<T> {
  try {
    return (await import(/* @vite-ignore */ moduleName)) as T;
  } catch (err) {
    const hint = `The '${moduleName}' package is not installed. Install it with:\n  ${install}`;
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`${hint}\n\nUnderlying error: ${cause}`);
  }
}

export function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError ? { isError: true } : {}),
  };
}

export function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}

export function errorResult(message: string) {
  return textResult(`ERROR: ${message}`, true);
}
