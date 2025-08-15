import { CodeJar } from "./external/codejar/codejar.ts";
import { withLineNumbers } from "./external/codejar/codejar-linenumbers.ts";
import Prism from "./external/prism.js";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message || "assertion failed");
  }
}

const markErrorLine = (jarObj: JarObj, lineNumber: number) => {
  const rightPane = document.querySelector("#editor-console-pane");
  assert(rightPane !== null, "#editor-console-pane is not defined");

  const editor = document.querySelector("#editor");
  assert(editor !== null, "#editor is not defined");

  const divErrorMarker = document.createElement("div");

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

  rightPane.appendChild(divErrorMarker);

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

    const resConsole = document.querySelector("#console .text-box .text");
    assert(resConsole !== null, "No res console");

    const nextBtn = document.getElementById("next-btn");
    assert(nextBtn !== null, "No res console");

    if (answerCorrect === "true") {
      resConsole.insertAdjacentHTML(
        "beforebegin",
        `<span class='console-result passed'>Aprovado ${
          String.fromCodePoint(0x2714)
        }</span>`,
      );
      nextBtn.removeAttribute("disabled");
    } else {
      resConsole.insertAdjacentHTML(
        "beforebegin",
        `<span class='console-result failed'>Reprobado ${
          String.fromCodePoint(0x274C)
        }</span>`,
      );
      nextBtn.setAttribute("disabled", "");
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
  check = false,
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
    if (check) {
      checkResponse(unitid, lessonid, consoleoutput);
    }

    document.querySelectorAll(".console-result").forEach((elem) =>
      elem.remove()
    );
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
  const res = await fetch(`/getjson/${unitid}/${lessonid}`);
  const lessondata = await res.json();

  const code = lessondata.starting_code;
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
function highlightCodeBlocks() {
  const codeBlocks = document.querySelectorAll("code");
  codeBlocks.forEach((elem) => {
    const highlighted = Prism.highlight(
      elem.innerHTML,
      // @ts-ignore: it does
      Prism.languages.javascript,
      "javascript",
    );
    elem.innerHTML = highlighted;
  });
}

function gotoNextLesson(nextlesson: string) {
  const [unitid, lessonid] = nextlesson.split(",");

  const path = `/lesson/${unitid}/${lessonid}`;
  window.location.replace(path);
}

document.addEventListener("DOMContentLoaded", () => {
  const editor = document.querySelector("#editor") as HTMLElement;

  const jar = CodeJar(editor, withLineNumbers(highlight), options);

  const outConsole = document.querySelector("#console .text") as HTMLElement;

  const divLessonInfo: HTMLElement | null = document.querySelector(
    "#lessoninfo",
  );
  assert(divLessonInfo !== null, "No .lessoninfo");

  const lessonInfo: string | undefined = divLessonInfo.dataset.lessonId;
  assert(lessonInfo !== undefined, "No lessoninfo");

  const [unitid, lessonid]: number[] = lessonInfo.split(",").map(
    (num) => {
      const intForm = parseInt(num);
      assert(!isNaN(intForm), "Lesson info parts not int");
      return intForm;
    },
  );

  setCode(jar, unitid, lessonid);
  highlightCodeBlocks();

  const btnClickHandler = (e: Event) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains("button")) {
      const action: string | undefined = target.dataset.action;

      if (action) {
        switch (action) {
          case "run":
            RunCode(jar, outConsole, unitid, lessonid);
            break;
          case "next":
            gotoNextLesson(target.dataset.nextlesson!);
            break;
          case "runAndCheck":
            RunCode(jar, outConsole, unitid, lessonid, true);
            break;
          default:
            return;
        }
      }
    }
  };

  const buttons: NodeListOf<HTMLElement> = document.querySelectorAll(
    ".buttons",
  );
  buttons.forEach((elem) => {
    elem.addEventListener("click", btnClickHandler);
  });
});
