import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import path from "node:path";

const PRIVATE_KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge/private/personal");
const TAXONOMY_PATH = path.join(PRIVATE_KNOWLEDGE_ROOT, "taxonomy.json");
const PRIVATE_INDEX_SUMMARY = "点击查看完整 OKF 正文（仅本地可见）。";

type TaxonomyAssignment = {
  concept_id: string;
  route_id: string;
  title: string;
  description: string;
  type: string;
  source_system: string;
  disposition: string;
  domain: string | null;
  topic: string | null;
};

type TaxonomyDomain = {
  accent: string;
  count: number;
  description: string;
  slug: string;
  title: string;
  topics: Array<{ count: number; slug: string; title: string }>;
};

type PrivateTaxonomy = {
  counts: {
    classified: number;
    review: number;
    total: number;
  };
  domains: TaxonomyDomain[];
  assignments: TaxonomyAssignment[];
};

function readPrivateUtf8File(file: string) {
  const descriptor = Reflect.apply(openSync, undefined, [file, "r"]);
  try {
    return readFileSync(descriptor, "utf8");
  } finally {
    closeSync(descriptor);
  }
}

export type PrivateKnowledgeConceptIndex = {
  routeId: string;
  summary: string;
  title: string;
  topicSlug: string | null;
  type: string;
  sourceSystem: string;
};

export type PrivateKnowledgeConcept = PrivateKnowledgeConceptIndex & {
  body: string;
  conceptId: string;
  sourceFormat: string;
};

function loadTaxonomy(): PrivateTaxonomy | null {
  if (!privateKnowledgeIsAvailable()) return null;
  return JSON.parse(readPrivateUtf8File(TAXONOMY_PATH)) as PrivateTaxonomy;
}

function parseFrontmatter(source: string) {
  if (!source.startsWith("---\n")) return { body: source, fields: new Map<string, string>() };
  const end = source.indexOf("\n---\n", 4);
  if (end < 0) return { body: source, fields: new Map<string, string>() };
  const fields = new Map<string, string>();
  for (const line of source.slice(4, end).split("\n")) {
    const match = line.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/u);
    if (!match) continue;
    try {
      fields.set(match[1], JSON.parse(match[2].trim()));
    } catch {
      fields.set(match[1], match[2].trim());
    }
  }
  let body = source.slice(end + 5).trim();
  body = body.replace(/^#\s+[^\n]+\n+/u, "").replace(/^>[^\n]*(?:\n+|$)/u, "").trim();
  return { body, fields };
}

function resolveConceptPath(conceptId: string) {
  if (!/^\/(?:[a-z0-9._-]+\/)+[a-z0-9._-]+\.md$/iu.test(conceptId)) {
    throw new Error("Invalid private knowledge concept path");
  }
  const segments = conceptId.slice(1).split("/");
  if (
    segments.some((segment) => segment === "." || segment === "..")
    || segments[0] === "topics"
  ) {
    throw new Error("Private knowledge concept escaped its bundle");
  }
  return [PRIVATE_KNOWLEDGE_ROOT, ...segments].join(path.sep);
}

export function privateKnowledgeIsAvailable() {
  return process.env.NODE_ENV !== "production" && existsSync(TAXONOMY_PATH);
}

export function readPrivateTaxonomySummary() {
  const taxonomy = loadTaxonomy();
  return taxonomy ? { ...taxonomy.counts } : null;
}

export function listPrivateKnowledgeDomains() {
  return loadTaxonomy()?.domains ?? [];
}

export function listPrivateKnowledgeConcepts(domainSlug: string) {
  const taxonomy = loadTaxonomy();
  if (!taxonomy || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(domainSlug)) return [];
  const assignments = domainSlug === "review"
    ? taxonomy.assignments.filter((item) => item.disposition === "review")
    : taxonomy.assignments.filter((item) => item.disposition === "classified" && item.domain === domainSlug);
  return assignments.map((item): PrivateKnowledgeConceptIndex => ({
    routeId: item.route_id,
    title: item.title,
    summary: PRIVATE_INDEX_SUMMARY,
    topicSlug: item.topic,
    type: item.type,
    sourceSystem: item.source_system,
  }));
}

export function readPrivateKnowledgeConcept(routeId: string): PrivateKnowledgeConcept | null {
  if (!privateKnowledgeIsAvailable() || !/^[a-f0-9]{16}$/u.test(routeId)) return null;
  const assignment = loadTaxonomy()?.assignments.find((item) => item.route_id === routeId);
  if (!assignment || !["classified", "review"].includes(assignment.disposition)) return null;
  const file = resolveConceptPath(assignment.concept_id);
  if (!existsSync(file)) return null;
  const parsed = parseFrontmatter(readPrivateUtf8File(file));
  return {
    routeId,
    conceptId: assignment.concept_id,
    title: assignment.title,
    summary: assignment.description || `${assignment.type} · 来源 ${assignment.source_system}`,
    topicSlug: assignment.topic,
    type: assignment.type,
    sourceSystem: assignment.source_system,
    sourceFormat: parsed.fields.get("source_format") ?? "markdown",
    body: parsed.body,
  };
}
