import { CodeJar } from "./external/codejar/codejar.ts";
import { withLineNumbers } from "./external/codejar/codejar-linenumbers.ts";
import Prism from "./external/prism.js";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message || "assertion failed");
  }
};
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

async function getCodeForLesson(
  unitid: number,
  lessonid: number,
): Promise<string | undefined> {
  const res = await fetch(`/getunit/${unitid}/${lessonid}`);
  const unitdata = await res.json();

  const code = unitdata.lessons[lessonid].code;
  return code;
}

async function setCode(jar: JarObj, unitid: number, lessonid: number) {
  const code = await getCodeForLesson(unitid, lessonid);
  if (code === undefined) {
    console.warn("No initial code in json");
    return;
  }
  console.log("initial code", code);
  jar.updateCode(code);
}

document.addEventListener("DOMContentLoaded", () => {
  const editor = document.querySelector("#editor") as HTMLElement;

  const jar = CodeJar(editor, withLineNumbers(highlight), options);

  const buttons = document.querySelector(".buttons") as HTMLElement;
  const outConsole = document.querySelector("#console .text") as HTMLElement;

  const lessoninfo: string[] | undefined = document.querySelector("#lessoninfo")
    ?.getAttribute(
      "data-lesson-id",
    )?.split(",");

  if (lessoninfo === undefined) {
    throw new Error("No current lesson info");
  }

  const unitid = parseInt(lessoninfo[1]);
  const lessonid = parseInt(lessoninfo[1]);
  assert(
    !isNaN(unitid) && !isNaN(lessonid),
    "Unit ID or Lesson ID not a number",
  );

  setCode(jar, unitid, lessonid);

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
