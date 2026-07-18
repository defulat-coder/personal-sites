import { createHash } from "node:crypto";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function resolveInside(root, child, label) {
  const resolved = path.resolve(root, child);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label}-outside-root`);
  }
  return resolved;
}

export async function assertRegularFile(file, root, label) {
  resolveInside(root, path.relative(root, file), label);
  const details = await lstat(file);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error(`${label}-not-regular-file`);
}

export async function writeUtf8Exclusive(root, relative, body) {
  const target = resolveInside(root, relative, "output");
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
}
