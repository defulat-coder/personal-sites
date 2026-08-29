import type Database from "better-sqlite3";

export type PublicDataHealthEvidence = {
  askDocuments: number;
  askFts: number;
  askMissingFts: number;
  askOrphanFts: number;
  curation: {
    douyin: { count: number; latestAt: string | null };
    x: { count: number; latestAt: string | null };
  };
  openSource: { count: number; latestAt: string | null };
  quickCheck: string;
  works: { count: number; latestAt: string | null };
};

export function readPublicDataHealth(database: Database.Database): PublicDataHealthEvidence;
