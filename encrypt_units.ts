const unitRegex = /unit\-\d+\.json/;
const args = Deno.args;
import { marked } from "marked";

// Example: deno run script.ts --name=Alice --verbose
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

async function encryptStr(data: string): Promise<string> {
  const encoder = new TextEncoder();

  const rawKey = encoder.encode("qd!H%~0R3uvuKE2j96z2Q!d/ET<J#2Ya");
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const iv = encoder.encode("8p0=oO@KQ4aS");

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data),
  );

  const cipheredText = btoa(
    String.fromCharCode(...new Uint8Array(ciphertextBuffer)),
  );
  return cipheredText;
}

async function handleFile(filename: string) {
  const path = `${indir}/${filename}`;
  let unitJson = getUnitJson(path);

  unitJson = uncompleteJson(unitJson);
  unitJson = parseMD(unitJson);

  const jsonString = JSON.stringify(unitJson);
  console.log("Encrypting", filename);
  const encryptedString = await encryptStr(jsonString);

  const distPath = `${outdir}/${filename}`;
  await Deno.writeTextFile(distPath, encryptedString);
}
