#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env, pipeline } from "@huggingface/transformers";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = path.join(repoRoot, "data/sensitive/local-vectors.sqlite");
const curationDatabasePath = path.join(repoRoot, "data/curation.sqlite");
const modelCachePath = path.join(repoRoot, "data/sensitive/model-cache");
const defaultInputs = [
  "knowledge/sensitive/personal/index.md",
  "knowledge/sensitive/personal/topics",
  "knowledge/sensitive/personal/github/index.md",
  "knowledge/sensitive/personal/github/curation-report.md",
  "data/sensitive/github/starred/derived",
  "data/sensitive/personal",
  "data/sensitive/personal-site",
];

const MODEL_ID = "onnx-community/bge-small-zh-v1.5-ONNX";
const MODEL_DTYPE = "q8";
const VECTOR_DIMENSIONS = 512;
const QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章：";
const BATCH_SIZE = 16;
const SUPPORTED_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);

function compactText(value) {
  return String(value ?? "")
    .replaceAll("\0", "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Keep chunks below BGE's 512-token ceiling without owning a tokenizer-aware
 * splitter. ponytail: 420 code points is conservative for Chinese/Markdown;
 * switch to token-based chunking only if retrieval evaluation shows truncation.
 */
export function splitText(value, maximumCharacters = 420, overlapCharacters = 60) {
  if (maximumCharacters <= overlapCharacters || overlapCharacters < 0) {
    throw new Error("分块参数无效：maximumCharacters 必须大于 overlapCharacters。");
  }

  const text = compactText(value);
  if (!text) return [];

  const chunks = [];
  let current = "";
  const pushCurrent = () => {
    if (current) chunks.push(current);
    current = "";
  };

  for (const paragraph of text.split("\n\n")) {
    const characters = Array.from(paragraph);
    if (characters.length > maximumCharacters) {
      pushCurrent();
      for (let start = 0; start < characters.length;) {
        const end = Math.min(start + maximumCharacters, characters.length);
        chunks.push(characters.slice(start, end).join("").trim());
        if (end === characters.length) break;
        start = end - overlapCharacters;
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (Array.from(candidate).length > maximumCharacters) pushCurrent();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  pushCurrent();
  return chunks.filter(Boolean);
}

export function mergeRankings(vectorRows, keywordRows, limit = 8) {
  const scores = new Map();
  for (const rows of [vectorRows, keywordRows]) {
    rows.forEach((row, index) => {
      const current = scores.get(row.id) ?? 0;
      scores.set(row.id, current + 1 / (60 + index + 1));
    });
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score || left.id - right.id)
    .slice(0, limit);
}

export function publicAskVectorSource(row) {
  return `${row.source_scope}/${row.source_id}/${row.id}`;
}

function resolveInsideRepo(input) {
  const absolutePath = path.resolve(repoRoot, input);
  const relativePath = path.relative(repoRoot, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`索引输入必须位于项目目录内：${input}`);
  }
  return absolutePath;
}

async function collectFiles(inputs, { ignoreMissing = false } = {}) {
  const files = [];

  async function visit(entryPath) {
    let entryStat;
    try {
      entryStat = await stat(entryPath);
    } catch (error) {
      if (ignoreMissing && error.code === "ENOENT") return;
      throw error;
    }
    if (entryStat.isFile()) {
      if (SUPPORTED_EXTENSIONS.has(path.extname(entryPath).toLowerCase())) files.push(entryPath);
      return;
    }
    if (!entryStat.isDirectory()) return;

    const entries = await readdir(entryPath, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) continue;
      await visit(path.join(entryPath, entry.name));
    }
  }

  for (const input of inputs) await visit(resolveInsideRepo(input));
  return [...new Set(files)].sort();
}

async function readChunks(inputs, options) {
  const chunks = [];
  const files = await collectFiles(inputs, options);
  for (const filePath of files) {
    const source = path.relative(repoRoot, filePath);
    const content = await readFile(filePath, "utf8");
    splitText(content).forEach((chunk, chunkIndex) => {
      chunks.push({ chunkIndex, content: chunk, source });
    });
  }
  return { chunks, fileCount: files.length };
}

function readPublicProjectionChunks() {
  const database = new Database(curationDatabasePath, { fileMustExist: true, readonly: true });
  try {
    const askRows = database.prepare(`
      SELECT id, source_scope, source_id, title, content
      FROM ask_documents
      ORDER BY id
    `).all();
    const workRows = database.prepare(`
      SELECT slug, snapshot_json
      FROM project_snapshots
      ORDER BY display_order, published_at DESC
    `).all();
    const askChunks = askRows.flatMap((row) =>
      splitText(`${row.title}\n\n${row.content}`).map((content, chunkIndex) => ({
        chunkIndex,
        content,
        source: publicAskVectorSource(row),
      })),
    );
    const workChunks = workRows.flatMap((row) => {
      const snapshot = JSON.parse(row.snapshot_json);
      const content = [
        snapshot.title,
        snapshot.summary,
        snapshot.currentFocus,
        snapshot.bodyMarkdown,
        ...(snapshot.records ?? []).flatMap((record) => [record.title, record.summary, record.bodyMarkdown]),
      ].filter(Boolean).join("\n\n");
      return splitText(content).map((chunk, chunkIndex) => ({
        chunkIndex,
        content: chunk,
        source: `works/${row.slug}`,
      }));
    });
    return { chunks: [...askChunks, ...workChunks], itemCount: askRows.length + workRows.length };
  } finally {
    database.close();
  }
}

async function createEmbedder() {
  env.cacheDir = modelCachePath;
  await mkdir(modelCachePath, { recursive: true });
  return pipeline("feature-extraction", MODEL_ID, {
    device: "cpu",
    dtype: MODEL_DTYPE,
  });
}

async function embed(embedder, texts) {
  const output = await embedder(texts, {
    normalize: true,
    pooling: "cls",
    truncation: true,
  });
  const vectors = output.tolist();
  if (vectors.some((vector) => vector.length !== VECTOR_DIMENSIONS)) {
    throw new Error(`模型输出维度不是预期的 ${VECTOR_DIMENSIONS}。`);
  }
  return vectors;
}

function contentHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readCachedVectors() {
  const vectors = new Map();
  if (!existsSync(databasePath)) return vectors;

  const database = new Database(databasePath, { fileMustExist: true, readonly: true });
  sqliteVec.load(database);
  try {
    const metadata = Object.fromEntries(
      database.prepare("SELECT key, value FROM metadata").all().map((row) => [row.key, row.value]),
    );
    if (metadata.model !== MODEL_ID || Number(metadata.dimensions) !== VECTOR_DIMENSIONS) return vectors;

    for (const row of database.prepare(`
      SELECT d.content, v.embedding
      FROM documents d
      JOIN document_vectors v ON v.rowid = d.id
    `).iterate()) {
      vectors.set(contentHash(row.content), Buffer.from(row.embedding));
    }
    return vectors;
  } finally {
    database.close();
  }
}

function initializeDatabase(filePath) {
  const database = new Database(filePath);
  sqliteVec.load(database);
  database.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      UNIQUE(source, chunk_index)
    ) STRICT;

    CREATE VIRTUAL TABLE documents_fts USING fts5(
      content,
      content='documents',
      content_rowid='id',
      tokenize='trigram'
    );

    CREATE VIRTUAL TABLE document_vectors USING vec0(
      embedding float[${VECTOR_DIMENSIONS}]
    );
  `);
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run("model", MODEL_ID);
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run("dtype", MODEL_DTYPE);
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run("dimensions", String(VECTOR_DIMENSIONS));
  return database;
}

async function buildIndex(inputs, { includeCuration = false } = {}) {
  const { chunks: fileChunks, fileCount } = await readChunks(inputs, { ignoreMissing: includeCuration });
  const publicProjection = includeCuration ? readPublicProjectionChunks() : { chunks: [], itemCount: 0 };
  const chunks = [...fileChunks, ...publicProjection.chunks];
  if (chunks.length === 0) throw new Error("没有找到可索引的 Markdown 或文本文件。");

  await mkdir(path.dirname(databasePath), { recursive: true });
  const temporaryPath = `${databasePath}.tmp`;
  await rm(temporaryPath, { force: true });

  console.log(
    `准备索引 ${fileCount} 个文件、${includeCuration ? `${publicProjection.itemCount} 条公开记录、` : ""}${chunks.length} 个分块；首次运行会下载本地模型。`,
  );
  const cachedVectors = readCachedVectors();
  let embedder;
  let generatedCount = 0;
  let reusedCount = 0;
  const database = initializeDatabase(temporaryPath);
  const insertDocument = database.prepare(
    "INSERT INTO documents(id, source, chunk_index, content) VALUES (?, ?, ?, ?)",
  );
  const insertKeyword = database.prepare(
    "INSERT INTO documents_fts(rowid, content) VALUES (?, ?)",
  );
  const insertVector = database.prepare(
    "INSERT INTO document_vectors(rowid, embedding) VALUES (?, ?)",
  );
  const insertBatch = database.transaction((batch, vectors, offset) => {
    batch.forEach((chunk, index) => {
      const id = offset + index + 1;
      insertDocument.run(id, chunk.source, chunk.chunkIndex, chunk.content);
      insertKeyword.run(id, chunk.content);
      insertVector.run(BigInt(id), vectors[index]);
    });
  });

  try {
    for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + BATCH_SIZE);
      const vectors = batch.map((chunk) => cachedVectors.get(contentHash(chunk.content)) ?? null);
      const missingIndexes = vectors.flatMap((vector, index) => vector ? [] : [index]);
      if (missingIndexes.length > 0) {
        embedder ??= await createEmbedder();
        const generated = await embed(embedder, missingIndexes.map((index) => batch[index].content));
        missingIndexes.forEach((batchIndex, generatedIndex) => {
          vectors[batchIndex] = new Float32Array(generated[generatedIndex]);
        });
      }
      generatedCount += missingIndexes.length;
      reusedCount += batch.length - missingIndexes.length;
      insertBatch(batch, vectors, offset);
      process.stdout.write(`\r已处理 ${Math.min(offset + batch.length, chunks.length)}/${chunks.length} 个向量`);
    }
    process.stdout.write("\n");
  } catch (error) {
    database.close();
    await rm(temporaryPath, { force: true });
    throw error;
  }

  database.close();
  await rename(temporaryPath, databasePath);
  console.log(`本地索引已写入 ${path.relative(repoRoot, databasePath)}（复用 ${reusedCount}，新生成 ${generatedCount}）。`);
}

export function rebuildDefaultIndex() {
  return buildIndex(defaultInputs, { includeCuration: true });
}

function quoteFtsQuery(query) {
  return `"${query.replaceAll('"', '""')}"`;
}

async function search(query) {
  if (!compactText(query)) throw new Error("搜索词不能为空。");

  const embedder = await createEmbedder();
  const [queryVector] = await embed(embedder, [`${QUERY_PREFIX}${compactText(query)}`]);
  const database = new Database(databasePath, { fileMustExist: true, readonly: true });
  sqliteVec.load(database);

  try {
    const metadata = Object.fromEntries(
      database.prepare("SELECT key, value FROM metadata").all().map((row) => [row.key, row.value]),
    );
    if (metadata.model !== MODEL_ID || Number(metadata.dimensions) !== VECTOR_DIMENSIONS) {
      throw new Error("索引模型配置已变化，请先重新运行 pnpm vectors:index。");
    }

    const candidateCount = 32;
    const vectorRows = database.prepare(`
      SELECT rowid AS id, distance
      FROM document_vectors
      WHERE embedding MATCH ? AND k = ?
      ORDER BY distance
    `).all(new Float32Array(queryVector), candidateCount);

    const keywordRows = Array.from(compactText(query)).length < 3
      ? []
      : database.prepare(`
          SELECT rowid AS id, bm25(documents_fts) AS rank
          FROM documents_fts
          WHERE documents_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(quoteFtsQuery(compactText(query)), candidateCount);

    const ranking = mergeRankings(vectorRows, keywordRows);
    if (ranking.length === 0) {
      console.log("没有找到相关内容。");
      return;
    }

    const placeholders = ranking.map(() => "?").join(",");
    const documents = database.prepare(
      `SELECT id, source, chunk_index, content FROM documents WHERE id IN (${placeholders})`,
    ).all(...ranking.map((row) => row.id));
    const byId = new Map(documents.map((document) => [document.id, document]));

    ranking.forEach((row, index) => {
      const document = byId.get(row.id);
      const preview = document.content.replace(/\s+/g, " ").slice(0, 220);
      console.log(`\n${index + 1}. ${document.source}#${document.chunk_index + 1} (${row.score.toFixed(4)})`);
      console.log(preview);
    });
  } finally {
    database.close();
  }
}

function printHelp() {
  console.log(`用法：
  pnpm vectors:index [项目内目录或文件 ...]
  pnpm vectors:search <查询内容>

默认索引：${defaultInputs.join("、")}
本地数据库：${path.relative(repoRoot, databasePath)}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "index") {
    const useDefaults = args.length === 0;
    return useDefaults ? rebuildDefaultIndex() : buildIndex(args);
  }
  if (command === "search") return search(args.join(" "));
  printHelp();
  if (command && command !== "help" && command !== "--help") process.exitCode = 1;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
