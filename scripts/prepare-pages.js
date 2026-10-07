import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "dist");
const output = resolve(root, "publish");

if (!output.startsWith(root + sep)) throw new Error("公開準備先が作業フォルダの外です。");
await mkdir(output, { recursive: true });
for (const entry of await readdir(output)) {
  if (entry === ".git") continue;
  const target = resolve(output, entry);
  if (!target.startsWith(output + sep)) throw new Error("公開準備先のパスが不正です。");
  await rm(target, { recursive: true, force: true });
}
for (const entry of await readdir(source)) {
  await cp(resolve(source, entry), resolve(output, entry), { recursive: true });
}
process.stdout.write(`GitHub Pages用のファイルを ${output} に準備しました。\n`);
