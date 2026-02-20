import blessed from "blessed";
import { evaluate } from "mathjs";

const QUERY_PATTERN = /^(.+)\s*=\s*\?$/;

const screen = blessed.screen({
  smartCSR: true,
  title: "Zue Math Editor",
  fullUnicode: true,
});

const editor = blessed.textarea({
  parent: screen,
  label: " Math Editor ",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%-3",
  border: "line",
  scrollbar: {
    ch: " ",
  },
  inputOnFocus: true,
  mouse: true,
  keys: true,
  vi: false,
  padding: {
    left: 1,
    right: 1,
  },
  style: {
    border: {
      fg: "cyan",
    },
    focus: {
      border: {
        fg: "green",
      },
    },
  },
  value: "a = 8\nb = 3 * a\nf(x) = x^2 + b\na + b = ?\nf(4) = ?",
});

// blessed textarea reserves Ctrl+E for opening an external editor.
// Override this so Ctrl+E is dedicated to Compute in this app.
(editor as any).readEditor = (_callback?: unknown): void => {
  // no-op
};

const results = blessed.box({
  parent: screen,
  label: " Results ",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%-3",
  border: "line",
  scrollable: true,
  alwaysScroll: true,
  hidden: true,
  mouse: true,
  keys: false,
  tags: false,
  scrollbar: {
    ch: " ",
  },
  padding: {
    left: 1,
    right: 1,
  },
  style: {
    border: {
      fg: "magenta",
    },
    focus: {
      border: {
        fg: "green",
      },
    },
  },
});

const status = blessed.box({
  parent: screen,
  bottom: 2,
  left: 0,
  width: "100%",
  height: 1,
  tags: false,
  style: {
    fg: "black",
    bg: "white",
  },
  content: " Mode: Editor | Define context, then compute term = ? with Ctrl+E ",
});

const controls = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: "100%",
  height: 2,
  tags: false,
  style: {
    fg: "black",
    bg: "green",
  },
  content:
    " ^E Compute   ^R Results   ^T Editor   ^↑/↓ Scroll Results   ^Q Quit\n Use shared context: defs/functions, then term = ? on one or more lines ",
});

let mode: "editor" | "results" = "editor";

function setStatus(message: string): void {
  status.setContent(` ${message} `);
}

function showEditor(): void {
  mode = "editor";
  results.hide();
  editor.show();
  editor.focus();
  setStatus("Mode: Editor | Define context + use term = ?, then Ctrl+E");
  screen.render();
}

function showResults(): void {
  mode = "results";
  editor.hide();
  results.show();
  results.focus();
  setStatus("Mode: Results | Scroll with Up/Down");
  screen.render();
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(10).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  if (value && typeof value === "object" && "toString" in value) {
    return String(value);
  }

  return JSON.stringify(value);
}

function computeInput(text: string): string {
  const lines = text.split(/\r?\n/);
  const scope: Record<string, unknown> = Object.create(null);
  const contextLogs: string[] = [];
  const resultLogs: string[] = [];
  let contextCount = 0;
  let queryCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const line = raw.trim();
    const lineNo = index + 1;

    if (line.length === 0 || line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    const queryMatch = line.match(QUERY_PATTERN);
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
          `[OK] Line ${lineNo}: {${term}} = ?`,
          "  1) Read term using the current context",
          `  2) Result: ${formatValue(value)}`,
          ""
        );
      } catch (error) {
        resultLogs.push(
          `[ERR] Line ${lineNo}: {${term}} = ?`,
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
  output.push(`Context statements: ${contextCount}`);
  output.push(`Queries: ${queryCount}`);

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

function computeAndShowResults(): void {
  const input = editor.getValue();
  const output = computeInput(input);
  results.setContent(output);
  results.setScroll(0);
  showResults();
}

screen.key(["C-e"], () => {
  computeAndShowResults();
});

editor.key(["C-e"], () => {
  computeAndShowResults();
});

screen.key(["C-r"], () => {
  showResults();
});

screen.key(["C-t"], () => {
  showEditor();
});

screen.key(["up"], () => {
  if (mode === "results") {
    results.scroll(-1);
    screen.render();
  }
});

screen.key(["down"], () => {
  if (mode === "results") {
    results.scroll(1);
    screen.render();
  }
});

screen.key(["pageup"], () => {
  if (mode === "results") {
    results.scroll(-10);
    screen.render();
  }
});

screen.key(["pagedown"], () => {
  if (mode === "results") {
    results.scroll(10);
    screen.render();
  }
});

screen.key(["C-q", "escape"], () => {
  screen.destroy();
  process.exit(0);
});

showEditor();
screen.render();
