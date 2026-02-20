import blessed from "blessed";
import { computeInput } from "./compute";

const DEFAULT_EDITOR_VALUE = "a = 8\nb = 3 * a\nf(x) = x^2 + b\na + b = ?\nf(4) = ?";

export function runTerminalApp(): void {
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
    value: DEFAULT_EDITOR_VALUE,
  });

  (editor as unknown as { readEditor: (_callback?: unknown) => void }).readEditor =
    (_callback?: unknown): void => {
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

  blessed.box({
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

  const setStatus = (message: string): void => {
    status.setContent(` ${message} `);
  };

  const showEditor = (): void => {
    mode = "editor";
    results.hide();
    editor.show();
    editor.focus();
    setStatus("Mode: Editor | Define context + use term = ?, then Ctrl+E");
    screen.render();
  };

  const showResults = (): void => {
    mode = "results";
    editor.hide();
    results.show();
    results.focus();
    setStatus("Mode: Results | Scroll with Up/Down");
    screen.render();
  };

  const computeAndShowResults = (): void => {
    const input = editor.getValue();
    const output = computeInput(input);
    results.setContent(output);
    results.setScroll(0);
    showResults();
  };

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
}
