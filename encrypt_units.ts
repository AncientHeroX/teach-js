const unitRegex = /unit\-\d+\.json/;
const args = Deno.args;
import { marked } from "marked";

let indir = "src/units";
let outdir = "public/units";

for (const arg of args) {
  if (arg.startsWith("--in=")) {
    indir = arg.split("=")[1];
  } else if (arg.startsWith("--out=")) {
    outdir = arg.split("=")[1];
  }
}

const entries = Deno.readDir(indir);
for await (const entry of entries) {
  if (unitRegex.test(entry.name)) {
    handleFile(entry.name);
  }
}

function getUnitJson(path: string): any | null {
  try {
    const data = Deno.readFileSync(path);

    const decoder = new TextDecoder("utf-8");
    const str: string = decoder.decode(data);

    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

function parseMD(json: any): any {
  for (let i = 0; i < json.lessons.length; i++) {
    json.lessons[i].content = marked.parse(json.lessons[i].content);
  }
  return json;
}
function uncompleteJson(json: any): any {
  for (let i = 0; i < json.lessons.length; i++) {
    json.lessons[i].complete = false;
  }
  return json;
}

function encryptStr(dataStr: string): Uint8Array {
  const keyStr = "qd!H%~0R3uvuKE2j96z2Q!d/ET<J#2Ya";
  const key = new TextEncoder().encode(keyStr);

  const data = new TextEncoder().encode(dataStr);

  const out = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const k = key[i % key.length];

    out[i] = k ^ c;
  }

  return out;
}

async function handleFile(filename: string) {
  const path = `${indir}/${filename}`;
  let unitJson = getUnitJson(path);

  console.log("Encrypting", filename);

  unitJson = uncompleteJson(unitJson);
  unitJson = parseMD(unitJson);

  const jsonString = JSON.stringify(unitJson);

  const encryptedString = encryptStr(jsonString);

  const distPath = `${outdir}/${filename.slice(0, filename.indexOf("."))}.bin`;
  await Deno.writeFile(distPath, encryptedString);
}
