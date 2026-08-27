import "server-only";

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";

export const PUBLIC_DATABASE_PATH = path.join(process.cwd(), "data/curation.sqlite");

let database: Database.Database | undefined;

export function getPublicDatabase() {
  if (!existsSync(PUBLIC_DATABASE_PATH)) {
    throw new Error("缺少 data/curation.sqlite；请先生成本地公开投影。");
  }
  database ??= new Database(PUBLIC_DATABASE_PATH, { fileMustExist: true, readonly: true });
  return database;
}
