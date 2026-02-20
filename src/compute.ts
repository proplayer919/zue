import { evaluate } from "mathjs";

const QUERY_PATTERN = /^(.+)\s*=\s*\?$/;

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toString()
      : value.toFixed(10).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  return JSON.stringify(value);
}

export function computeInput(text: string): string {
  const lines = text.split(/\r?\n/);
  const scope: Record<string, unknown> = {};
  const contextLogs: string[] = [];
  const resultLogs: string[] = [];
  let contextCount = 0;
  let queryCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const line = raw.trim();
    const lineNo = index + 1;

    if (line.length === 0 || line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    const queryMatch = new RegExp(QUERY_PATTERN).exec(line);
    if (queryMatch) {
      queryCount += 1;
      const term = (queryMatch[1] ?? "").trim();

      if (!term) {
        resultLogs.push(`[ERR] Line ${lineNo}: empty query`, "  Use format: term = ?", "");
        continue;
      }

      try {
        const value = evaluate(term, scope);
        resultLogs.push(
          `[OK] Line ${lineNo}: ${term} = ?`,
          "  1) Read term using the current context",
          `  2) Result: ${formatValue(value)}`,
          ""
        );
      } catch (error) {
        resultLogs.push(
          `[ERR] Line ${lineNo}: ${term} = ?`,
          `  ${error instanceof Error ? error.message : "Unable to evaluate query"}`,
          ""
        );
      }

      continue;
    }

    contextCount += 1;
    try {
      evaluate(line, scope);
      contextLogs.push(`- L${lineNo}: ${line}`);
    } catch (error) {
      resultLogs.push(
        `[ERR] Line ${lineNo}: ${line}`,
        `  ${error instanceof Error ? error.message : "Invalid context statement"}`,
        ""
      );
    }
  }

  if (contextCount === 0 && queryCount === 0) {
    return [
      "No input to compute.",
      "",
      "Use one shared context:",
      "  a = 8",
      "  f(x) = x^2 + a",
      "  f(3) = ?",
    ].join("\n");
  }

  const output: string[] = [];
  output.push(`Context statements: ${contextCount}`, `Queries: ${queryCount}`);

  if (contextLogs.length > 0) {
    output.push("", "Context", ...contextLogs);
  }

  if (queryCount === 0) {
    output.push("", "No query lines found.", "Add one or more lines like: term = ?");

    if (resultLogs.length > 0) {
      output.push("", "Errors", ...resultLogs);
    }
  } else {
    output.push("", "Results", ...resultLogs);
  }

  return output.join("\n").trimEnd();
}
