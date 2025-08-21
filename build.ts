console.log("Creating directories");
await Deno.mkdir("dist", { recursive: true });

async function copyDir(src: string, dest: string) {
  await Deno.mkdir(dest, { recursive: true });

  for await (const entry of Deno.readDir(src)) {
    const srcPath = src + "/" + entry.name;
    const destPath = dest + "/" + entry.name;

    if (entry.isDirectory) {
      await copyDir(srcPath, destPath); // recurse
    } else if (entry.isFile) {
      await Deno.copyFile(srcPath, destPath);
    }
  }
}

await copyDir("./public", "./dist/public");
const encryptCmd = new Deno.Command("deno", {
  args: [
    "run",
    "-A",
    "encrypt_units.ts",
    "--in=src/units",
    "--out=dist/public/units",
  ],
});
const encProcess = encryptCmd.spawn();
const encStatus = await encProcess.status;

if (encStatus.success) {
  console.log("Units compiled");
} else {
  throw new Error(`Failed to encrypt.`);
}

console.log("Compiling server");
const appgo = "app.go";
const outputFile = Deno.build.os === "windows" ? "dist/app.exe" : "dist/app";

const compilecmd = new Deno.Command("go", {
  args: [
    "build",
    `-ldflags=-s -w`,
    "-o",
    outputFile,
    appgo,
  ],
});

const process = compilecmd.spawn();
const status = await process.status;

if (status.success) {
  console.log(`Compiled ${appgo} to ${outputFile} successfully!`);
} else {
  console.error(`Failed to compile ${appgo}.`);
}
