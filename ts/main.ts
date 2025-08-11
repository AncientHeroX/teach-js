import { CodeJar } from "./external/codejar/codejar.ts";
import { withLineNumbers } from "./external/codejar/codejar-linenumbers.ts";
import Prism from "./external/prism.js";

const CURR_DATA = {};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message || "assertion failed");
  }
};
const markErrorLine = (jarObj: JarObj, lineNumber: number) => {
  const rightPane = document.querySelector("#editor-console-pane");
  const editor = document.querySelector("#editor");
  const lineHeight = getComputedStyle(editor!).lineHeight;
  const divErrorMarker = document.createElement("div");

  console.log(lineHeight);
  divErrorMarker.style = `position: absolute;
                          margin-left: calc(1rem + 2px);
                          top: -2px;
                          color: hsl(var(--danger));
                          width: 1ch;
                          white-space: pre`;

  let newlines = "";
  for (let i = 0; i < lineNumber - 1; i++) {
    newlines = newlines + "\n";
  }
  divErrorMarker.innerText = newlines + String.fromCharCode(9632);

  rightPane?.appendChild(divErrorMarker);

  jarObj.onUpdate(() => {
    divErrorMarker.remove();

    jarObj.onUpdate(() => {});
  });
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
const checkResponse = async (
  unitid: number,
  lessonid: number,
  output: string,
) => {
  await fetch(`/checkresult/${unitid}/${lessonid}`, {
    method: "POST",
    body: JSON.stringify({ "result": output }),
  }).then(async (res) => {
    const answerCorrect = await res.text();

    if (answerCorrect === "true") {
      alert("Test Passed");
    } else {
      alert("Test Failed");
    }
  })
    .catch((err) => {
      console.log(err);
    });
};

const RunCode = (
  jarObj: JarObj,
  output: HTMLElement,
  unitid: number,
  lessonid: number,
) => {
  const writtenCode = jarObj.toString();
  const logs: string[] = [];
  const originalConsoleLog = console.log;

  try {
    console.log = (...args) => {
      logs.push(args.join(" "));
    };
    eval(
      `${writtenCode}\n//# sourceURL=submittedCode.js`,
    );
    const consoleoutput = logs.join("\n");
    checkResponse(unitid, lessonid, consoleoutput);

    output.innerText = logs.join("\n");
    output.scrollTop = output.scrollHeight;
  } catch (err) {
    console.log = originalConsoleLog;

    const stack = (err as Error).stack;

    if (stack) {
      const reg = stack.match(/\(submittedCode\.js:(\d+:\d+)\)/);

      if (reg) {
        const errLocation = reg[1].split(":");
        const errLine: number = parseInt(errLocation[0]);

        if (!isNaN(errLine)) {
          markErrorLine(jarObj, errLine);
        }
      }
    }
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

  const code = unitdata.lessons[lessonid].starting_code;
  return code;
}

async function setCode(jar: JarObj, unitid: number, lessonid: number) {
  const code = await getCodeForLesson(unitid, lessonid);
  if (code === undefined) {
    console.warn("No initial code in json");
    return;
  }
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
            RunCode(jar, outConsole, unitid, lessonid);
            break;
        }
      }
    }
  });
});
