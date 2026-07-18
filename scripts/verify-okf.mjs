import { lstat, opendir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolveInside(projectRoot, process.argv[2] ?? "config/okf.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const bundleRoot = resolveInside(projectRoot, process.argv[3] ?? config.output?.bundle_root ?? "knowledge/private/personal");
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const errors = [];
const warnings = [];
const concepts = [];
const indexes = [];
const logs = [];

function resolveInside(root, child) {
  const resolved = path.resolve(root, child);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path escapes root: ${child}`);
  }
  return resolved;
}

function addIssue(target, code, file, detail) {
  target.push({ code, file, ...(detail ? { detail } : {}) });
}

async function walkMarkdown(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    const stream = await opendir(directory);
    for await (const entry of stream) {
      const absolute = resolveInside(root, path.join(directory, entry.name));
      if (entry.isSymbolicLink()) {
        addIssue(errors, "symlink_not_allowed", path.relative(root, absolute));
      } else if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(absolute);
      }
    }
  }
  return files.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function stripPlainScalarComment(value) {
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  let squareDepth = 0;
  let curlyDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (doubleQuoted && escaped) {
      escaped = false;
      continue;
    }
    if (doubleQuoted && character === "\\") {
      escaped = true;
      continue;
    }
    if (!doubleQuoted && character === "'") singleQuoted = !singleQuoted;
    else if (!singleQuoted && character === '"') doubleQuoted = !doubleQuoted;
    else if (!singleQuoted && !doubleQuoted) {
      if (character === "[") squareDepth += 1;
      else if (character === "]") squareDepth -= 1;
      else if (character === "{") curlyDepth += 1;
      else if (character === "}") curlyDepth -= 1;
      else if (character === "#" && squareDepth === 0 && curlyDepth === 0 && (index === 0 || /\s/.test(value[index - 1]))) {
        return value.slice(0, index).trimEnd();
      }
    }
  }
  return value;
}

function validateBasicYamlValue(value, relative, lineNumber) {
  const trimmed = stripPlainScalarComment(value).trim();
  if (!trimmed) return;
  if (trimmed.startsWith('"')) {
    try {
      JSON.parse(trimmed);
    } catch {
      addIssue(errors, "frontmatter_invalid_double_quoted_scalar", relative, `line ${lineNumber}`);
    }
  } else if (trimmed.startsWith("'") && (!trimmed.endsWith("'") || /^'(?:[^']|'')*'$/.test(trimmed) === false)) {
    addIssue(errors, "frontmatter_invalid_single_quoted_scalar", relative, `line ${lineNumber}`);
  }
}

function parseTopLevelMapping(line, relative, lineNumber) {
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  let delimiter = -1;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (doubleQuoted && escaped) {
      escaped = false;
      continue;
    }
    if (doubleQuoted && character === "\\") {
      escaped = true;
      continue;
    }
    if (!doubleQuoted && character === "'") singleQuoted = !singleQuoted;
    else if (!singleQuoted && character === '"') doubleQuoted = !doubleQuoted;
    else if (!singleQuoted && !doubleQuoted && character === ":" && (index === line.length - 1 || /\s/.test(line[index + 1]))) {
      delimiter = index;
      break;
    }
  }
  if (delimiter <= 0) return null;
  const rawKey = line.slice(0, delimiter).trim();
  const value = line.slice(delimiter + 1).trimStart();
  let key = rawKey;
  if (rawKey.startsWith('"')) {
    try {
      key = JSON.parse(rawKey);
    } catch {
      addIssue(errors, "frontmatter_invalid_key", relative, `line ${lineNumber}`);
      return { key: null, value };
    }
  } else if (rawKey.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(rawKey)) {
      addIssue(errors, "frontmatter_invalid_key", relative, `line ${lineNumber}`);
      return { key: null, value };
    }
    key = rawKey.slice(1, -1).replaceAll("''", "'");
  } else if (/^[\[\]{},&*!|>@`]/.test(rawKey) || rawKey.includes(" #")) {
    addIssue(errors, "frontmatter_invalid_key", relative, `line ${lineNumber}`);
    return { key: null, value };
  }
  return { key, value };
}

function parseFrontmatter(source, relative) {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) return null;
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") {
      end = index;
      break;
    }
  }
  if (end < 0) {
    addIssue(errors, "frontmatter_not_closed", relative);
    return { fields: new Map(), body: "" };
  }
  const fields = new Map();
  let currentTopLevelKey = null;
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (line.includes("\t")) {
      addIssue(errors, "frontmatter_tab_not_allowed", relative, `line ${index + 1}`);
      continue;
    }
    if (/^\s/.test(line)) {
      if (!currentTopLevelKey) addIssue(errors, "frontmatter_orphan_indentation", relative, `line ${index + 1}`);
      continue;
    }
    const mapping = parseTopLevelMapping(line, relative, index + 1);
    if (!mapping) {
      addIssue(errors, "frontmatter_invalid_line", relative, `line ${index + 1}`);
      currentTopLevelKey = null;
      continue;
    }
    if (mapping.key === null) {
      currentTopLevelKey = null;
      continue;
    }
    if (fields.has(mapping.key)) addIssue(errors, "frontmatter_duplicate_key", relative, mapping.key);
    const value = mapping.value;
    validateBasicYamlValue(value, relative, index + 1);
    fields.set(mapping.key, stripPlainScalarComment(value).trim());
    currentTopLevelKey = mapping.key;
  }
  return { fields, body: lines.slice(end + 1).join("\n") };
}

function unquote(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

function validateIndex(relative, source, parsed) {
  const isRoot = relative === "index.md";
  if (parsed && !isRoot) addIssue(errors, "nested_index_frontmatter_not_allowed", relative);
  if (parsed && isRoot) {
    const version = unquote(parsed.fields.get("okf_version") ?? "");
    if (version !== "0.1") addIssue(errors, "root_index_okf_version_invalid", relative);
    for (const key of parsed.fields.keys()) {
      if (key !== "okf_version") addIssue(warnings, "root_index_extension_field", relative, key);
    }
  }
  const body = parsed?.body ?? source;
  if (!/^#\s+\S+/m.test(body)) addIssue(errors, "index_heading_missing", relative);
  indexes.push(relative);
}

function validateLog(relative, source, parsed) {
  if (parsed) addIssue(errors, "log_frontmatter_not_allowed", relative);
  if (!/^#\s+\S+/m.test(source)) addIssue(errors, "log_heading_missing", relative);
  const dates = [...source.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/gm)].map((match) => match[1]);
  if (dates.length === 0) addIssue(errors, "log_date_heading_missing", relative);
  for (const date of dates) {
    const [year, month, day] = date.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
      addIssue(errors, "log_date_invalid", relative, date);
    }
  }
  if (new Set(dates).size !== dates.length) addIssue(errors, "log_date_duplicate", relative);
  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index] > dates[index - 1]) addIssue(errors, "log_dates_not_newest_first", relative);
  }
  logs.push(relative);
}

function validateConcept(relative, parsed) {
  if (!parsed) {
    addIssue(errors, "concept_frontmatter_missing", relative);
    return;
  }
  const rawType = parsed.fields.get("type") ?? "";
  const type = unquote(rawType).trim();
  const yamlNulls = new Set(["null", "Null", "NULL", "~"]);
  const isString = type.length > 0
    && !yamlNulls.has(rawType)
    && !/^[\[{]/.test(rawType)
    && !/^(?:true|false|yes|no|on|off)$/i.test(rawType)
    && !/^[+-]?(?:\d[\d_]*)(?:\.\d[\d_]*)?(?:e[+-]?\d+)?$/i.test(rawType);
  if (!isString) addIssue(errors, "concept_type_missing_or_not_string", relative);
  const timestamp = unquote(parsed.fields.get("timestamp") ?? "");
  if (timestamp && !Number.isFinite(Date.parse(timestamp))) addIssue(warnings, "concept_timestamp_invalid", relative);
  concepts.push({ id: relative.slice(0, -3), type });
}

try {
  const rootDetails = await lstat(bundleRoot);
  if (!rootDetails.isDirectory() || rootDetails.isSymbolicLink()) throw new Error("Bundle root must be a real directory");
  for (const file of await walkMarkdown(bundleRoot)) {
    const relative = path.relative(bundleRoot, file).split(path.sep).join("/");
    let source;
    try {
      source = utf8Decoder.decode(await readFile(file));
    } catch (error) {
      addIssue(errors, "markdown_not_utf8", relative, error.message);
      continue;
    }
    const parsed = parseFrontmatter(source, relative);
    if (path.basename(relative) === "index.md") validateIndex(relative, source, parsed);
    else if (path.basename(relative) === "log.md") validateLog(relative, source, parsed);
    else validateConcept(relative, parsed);
  }
} catch (error) {
  addIssue(errors, "bundle_unreadable", ".", error.code ?? error.message);
}

for (const warning of warnings) console.warn(`WARN ${warning.code} ${warning.file}`);
if (errors.length > 0) {
  for (const error of errors.slice(0, 100)) console.error(`ERROR ${error.code} ${error.file}`);
  if (errors.length > 100) console.error(`ERROR ${errors.length - 100} additional errors omitted`);
  console.error(`OKF verification failed: concepts=${concepts.length}, indexes=${indexes.length}, logs=${logs.length}, errors=${errors.length}`);
  process.exitCode = 1;
} else {
  console.log(`OKF v${config.okf_version} verified: concepts=${concepts.length}, indexes=${indexes.length}, logs=${logs.length}, warnings=${warnings.length}`);
}
