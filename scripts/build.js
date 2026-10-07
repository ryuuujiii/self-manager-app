import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const assets = ["index.html", "styles.css", "sw.js", "manifest.webmanifest", "src", "assets"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of assets) {
  await cp(resolve(root, path), resolve(output, path), { recursive: true });
}
await writeFile(resolve(output, ".nojekyll"), "");
process.stdout.write(`公開用ファイルを ${output} に作成しました。\n`);
