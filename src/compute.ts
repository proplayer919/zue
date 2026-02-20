import { evaluate, parse } from "mathjs";

const QUERY_PATTERN = /^(.+)\s*=\s*\?$/;
const FUNCTION_DEFINITION_PATTERN = /^([A-Za-z_]\w*)\s*\(([^)]*)\)\s*=\s*(.+)$/;

type FunctionDefinition = {
  params: string[];
  body: string;
};

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

function splitTopLevelArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of input) {

    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }

    if (char === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    args.push(current.trim());
  }

  return args;
}

function getKnownSymbols(term: string, scope: Record<string, unknown>): Array<[string, unknown]> {
  const node = parse(term);
  const symbols = new Set<string>();

  node.traverse((child) => {
    if (child.type === "SymbolNode" && "name" in child && typeof child.name === "string") {
      symbols.add(child.name);
    }
  });

  return [...symbols]
    .filter((name) => Object.hasOwn(scope, name))
    .map((name) => [name, scope[name]])
    .filter((entry): entry is [string, unknown] => entry[1] !== undefined);
}

function buildFunctionWorkingSteps(
  term: string,
  scope: Record<string, unknown>,
  functions: Map<string, FunctionDefinition>
): string[] {
  const directCall = /^([A-Za-z_]\w*)\s*\((.*)\)$/.exec(term);
  if (!directCall) {
    return [];
  }

  const fnName = (directCall[1] ?? "").trim();
  const argsRaw = (directCall[2] ?? "").trim();
  const definition = functions.get(fnName);
  if (!definition) {
    return [];
  }

  const args = argsRaw.length === 0 ? [] : splitTopLevelArgs(argsRaw);
  if (args.length !== definition.params.length) {
    return [];
  }

  let substituted = definition.body;
  const bindings: string[] = [];

  for (let index = 0; index < definition.params.length; index += 1) {
    const param = definition.params[index] ?? "";
    const arg = args[index] ?? "";
    bindings.push(`${param} = ${arg}`);
    substituted = substituted.replaceAll(new RegExp(String.raw`\b${param}\b`, "g"), `(${arg})`);
  }

  const steps: string[] = [];
  steps.push(
    `  2) Function rule: ${fnName}(${definition.params.join(", ")}) = ${definition.body}`,
    `  3) Substitute arguments: ${bindings.join(", ")}`,
    `  4) Expanded form: ${substituted}`
  );

  try {
    const expandedValue = evaluate(substituted, scope);
    steps.push(`  5) Evaluate expanded form: ${formatValue(expandedValue)}`);
  } catch {
    // If expanded form can't be directly evaluated, keep earlier steps.
  }

  return steps;
}

function buildGenericWorkingSteps(term: string, scope: Record<string, unknown>): string[] {
  const known = getKnownSymbols(term, scope);
  if (known.length === 0) {
    return [];
  }

  const substitutions = known
    .map(([name, value]) => `${name} = ${formatValue(value)}`)
    .join(", ");

  let substituted = term;
  for (const [name, value] of known) {
    if (typeof value === "number" || typeof value === "string") {
      substituted = substituted.replaceAll(new RegExp(String.raw`\b${name}\b`, "g"), `(${formatValue(value)})`);
    }
  }

  return [`  2) Substitute known values: ${substitutions}`, `  3) Evaluate: ${substituted}`];
}

export function computeInput(text: string): string {
  const lines = text.split(/\r?\n/);
  const scope: Record<string, unknown> = {};
  const functions = new Map<string, FunctionDefinition>();
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
        const functionWorking = buildFunctionWorkingSteps(term, scope, functions);
        const genericWorking = functionWorking.length > 0 ? [] : buildGenericWorkingSteps(term, scope);
        const value = evaluate(term, scope);
        let resultStepNumber = "2";
        if (genericWorking.length > 0) {
          resultStepNumber = "4";
        }
        if (functionWorking.length > 0) {
          resultStepNumber = "6";
        }
        resultLogs.push(
          `[OK] Line ${lineNo}: ${term} = ?`,
          "  1) Read term using the current context",
          ...functionWorking,
          ...genericWorking,
          `  ${resultStepNumber}) Result: ${formatValue(value)}`,
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
      const functionMatch = new RegExp(FUNCTION_DEFINITION_PATTERN).exec(line);
      if (functionMatch) {
        const name = (functionMatch[1] ?? "").trim();
        const paramsRaw = (functionMatch[2] ?? "").trim();
        const body = (functionMatch[3] ?? "").trim();
        const params = paramsRaw
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        functions.set(name, {
          params,
          body,
        });
      }

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
