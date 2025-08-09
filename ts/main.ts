import { CodeJar } from "./external/codejar/codejar.ts";
import { withLineNumbers } from "./external/codejar/codejar-linenumbers.ts";
import Prism from "./external/prism.js";

type JarObj = ReturnType<typeof CodeJar>;
const options = {
  tab: "  ",
};

const highlight = (editor: any) => {
  const code = editor.textContent;
  const highlighted = Prism.highlight(
    code,
    // @ts-ignore: it does
    Prism.languages.javascript,
    "javascript",
  );
  editor.innerHTML = highlighted;
};

const RunCode = (jarObj: JarObj, output: HTMLElement) => {
  const writtenCode = jarObj.toString();
  const logs: string[] = [];
  const originalConsoleLog = console.log;

  console.log = (...args) => {
    logs.push(args.join(" "));
  };

  try {
    eval(writtenCode);
    output.innerText = logs.join("\n");
    output.scrollTop = output.scrollHeight;
  } catch (err) {
    output.innerHTML = `<span class="console-error">${err}</span>`;
  }
  console.log = originalConsoleLog;
};

document.addEventListener("DOMContentLoaded", () => {
  const editor = document.querySelector("#editor") as HTMLElement;

  let jar = CodeJar(editor, withLineNumbers(highlight), options);
  jar.updateCode("// Codigo aqui");

  const buttons = document.querySelector(".buttons") as HTMLElement;
  const outConsole = document.querySelector("#console .text") as HTMLElement;

  buttons.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains("button")) {
      const action: string | undefined = target.dataset.action;
      if (action) {
        switch (action) {
          case "run":
            RunCode(jar, outConsole);
            break;
        }
      }
    }
  });
});
