export type WorkShot = {
  label: string;
  src: string;
};

export type WorkRecordKind = "capability" | "decision" | "experiment" | "milestone" | "practice";

export const workRecordKindLabels: Record<WorkRecordKind, string> = {
  capability: "当前能力",
  decision: "关键决策",
  experiment: "实验记录",
  milestone: "项目里程碑",
  practice: "沉淀实践",
};

export type WorkEvidence = {
  id: string;
  kind: "commit" | "document" | "private-verification";
  label: string;
  occurredAt: string | null;
  url?: string;
  verifiedAt?: string | null;
};

export type WorkRecord = {
  bodyMarkdown?: string;
  evidence: WorkEvidence[];
  id: string;
  kind: WorkRecordKind;
  occurredAt?: string | null;
  relatedRecordIds: string[];
  status: string;
  summary: string;
  title: string;
  topics: string[];
  updatedAt: string;
};

export type WorkEntry = {
  currentFocus?: string;
  order: number;
  period: string;
  publishedAt?: string;
  repo?: string;
  records?: WorkRecord[];
  role: string;
  shots: WorkShot[];
  slug: string;
  sourceObservedAt?: string | null;
  stack: string[];
  status: string;
  summary: string;
  title: string;
  url?: string;
};

export type Work = WorkEntry & {
  body: string;
};
