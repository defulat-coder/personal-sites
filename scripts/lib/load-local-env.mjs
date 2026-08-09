import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseValue(rawValue) {
  const value = rawValue.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Load a local .env file without letting it overwrite explicitly exported shell variables.
 * The file is ignored by Git and is intended only for local automation credentials.
 */
export function loadLocalEnv(repoRoot, env = process.env) {
  const envPath = path.join(repoRoot, ".env.local");
  if (!existsSync(envPath)) return false;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    const [, key, rawValue] = match;
    if (env[key] === undefined) env[key] = parseValue(rawValue);
  }

  return true;
}
