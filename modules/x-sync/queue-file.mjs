import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeTextAtomically(filePath, text, { mode = 0o600 } = {}) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, text, { mode });
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export function writeJsonAtomically(filePath, value, options) {
  return writeTextAtomically(filePath, JSON.stringify(value, null, 2) + "\n", options);
}
