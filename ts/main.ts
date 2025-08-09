import { CodeJar } from "./external/codejar/codejar.ts";
import { withLineNumbers } from "./external/codejar/codejar-linenumbers.ts";
import Prism from "./external/prism.js";

const options = {
  tab: "  ",
  spellcheck: true,
};
const highlight = (editor) => {
  const code = editor.textContent;
  const highlighted = Prism.highlight(
    code,
    Prism.languages.javascript,
    "javascript",
  );
  editor.innerHTML = highlighted;
};

document.addEventListener("DOMContentLoaded", () => {
  const editor = document.querySelector("#editor") as HTMLElement;

  let jar = CodeJar(editor, withLineNumbers(highlight), options);
  jar.updateCode("// Codigo aqui");
});
