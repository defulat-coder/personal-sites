import { readFile } from "node:fs/promises";

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

/**
 * Pi allocates a session path before the first assistant message arrives.
 * A cancelled or failed generation can therefore have a path without a file.
 */
export async function readPersistableSessionFile(sessionFile: string | undefined) {
  if (!sessionFile) return undefined;

  try {
    return await readFile(/* turbopackIgnore: true */ sessionFile);
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    throw error;
  }
}
