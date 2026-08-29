export type DataSourceStatus = {
  ageMinutes: number | null;
  count: number;
  healthy: boolean;
  latestAt: string | null;
};

export type DataHealth = {
  aiNews: { ageMinutes: number | null; healthy: boolean; lastError?: string | null; lastStartedAt?: string | null; lastSucceededAt: string | null; running: boolean };
  askIndex: { documents: number; fts: number; healthy: boolean; missingFts: number; orphanFts: number };
  curation: { douyin: DataSourceStatus; x: DataSourceStatus };
  database: { healthy: boolean; quickCheck: string };
  deployment: { commit: string | null };
  generatedAt: string;
  healthy: boolean;
  insights: { analysisErrors: number | null; designReview: number | null } | null;
  openSource: DataSourceStatus;
  warnings: string[];
  works: DataSourceStatus;
};

export function buildDataHealth(options: {
  aiNews: DataHealth["aiNews"];
  commit?: string | null;
  insights?: DataHealth["insights"];
  now?: Date;
  publicData: {
    askDocuments: number;
    askFts: number;
    askMissingFts: number;
    askOrphanFts: number;
    curation: { douyin: { count: number; latestAt: string | null }; x: { count: number; latestAt: string | null } };
    openSource: { count: number; latestAt: string | null };
    quickCheck: string;
    works: { count: number; latestAt: string | null };
  };
}): DataHealth;
