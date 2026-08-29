import { createHash } from "node:crypto";

export const ANALYSIS_PIPELINE_VERSION = 1;
export const EDITORIAL_STAGE_VERSION = 2;
export const FACTS_STAGE_VERSION = 1;
export const VISUAL_STAGE_VERSION = 1;
export const DESIGN_STAGE_VERSION = 2;

const TOOL_DOMAINS = {
  "anthropic.com": "Anthropic",
  "cloudflare.com": "Cloudflare",
  "cursor.com": "Cursor",
  "figma.com": "Figma",
  "github.com": "GitHub",
  "huggingface.co": "Hugging Face",
  "linear.app": "Linear",
  "notion.so": "Notion",
  "openai.com": "OpenAI",
  "producthunt.com": "Product Hunt",
  "supabase.com": "Supabase",
  "vercel.com": "Vercel",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
};

function uniqueStrings(values, limit = 50) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].slice(0, limit);
}

function hostFromUrl(value) {
  try {
    return new URL(value).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  } catch {
    return null;
  }
}

function toolForHost(host) {
  if (!host) return null;
  const match = Object.entries(TOOL_DOMAINS).find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  return match?.[1] ?? null;
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function asIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizedList(value, limit = 15) {
  return uniqueStrings(Array.isArray(value) ? value : [], limit);
}

export function extractCurationFacts(item) {
  const text = [item.text, item.quoteContext?.text].filter(Boolean).join("\n");
  const urls = (item.links ?? [])
    .map((link) => link.expanded ?? link.original)
    .filter(Boolean);
  const domains = uniqueStrings(urls.map(hostFromUrl).filter(Boolean));
  const sourceKinds = uniqueStrings(String(item.fetchSource ?? "").split("+").map((source) =>
    source === "bookmarks" ? "bookmark" : source === "likes" ? "like" : source));

  return {
    version: FACTS_STAGE_VERSION,
    contentType: item.isQuote ? "quote" : item.isReply ? "reply" : "original",
    domains,
    hashtags: uniqueStrings([...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1].toLocaleLowerCase("en-US"))),
    linkTypes: uniqueStrings((item.links ?? []).map((link) => link.type ?? "external")),
    mediaTypes: uniqueStrings((item.media ?? []).map((media) => media.type ?? "photo")),
    mentions: uniqueStrings([...text.matchAll(/(?:^|[^\w])@([A-Za-z0-9_]{1,15})/gu)].map((match) => match[1].toLocaleLowerCase("en-US"))),
    sourceKinds,
    tools: uniqueStrings(domains.map(toolForHost).filter(Boolean)),
  };
}

export function curationInputHash(item) {
  return stableHash({
    author: item.author,
    createdAt: item.createdAt,
    fetchSource: item.fetchSource,
    links: item.links,
    media: item.media,
    quoteContext: item.quoteContext,
    replyContext: item.replyContext,
    text: item.text,
  });
}

export function curationVisualHash(item) {
  return stableHash((item.media ?? []).map((media) => ({
    previewUrl: media.previewUrl ?? null,
    type: media.type ?? "photo",
    url: media.url ?? null,
    videoUrl: media.videoUrl ?? null,
  })));
}

export function normalizeSearchSignals(value) {
  const source = value && typeof value === "object" ? value : {};
  const sentiment = String(source.sentiment ?? "neutral").toLocaleLowerCase("en-US");
  return {
    concepts: normalizedList(source.concepts),
    entities: normalizedList(source.entities, 10),
    problems: normalizedList(source.problems, 10),
    sentiment: new Set(["positive", "negative", "neutral", "humorous", "controversial"]).has(sentiment)
      ? sentiment
      : "neutral",
    tools: normalizedList(source.tools, 10),
    useCases: normalizedList(source.useCases, 10),
  };
}

export function normalizeVisualFacts(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    interactionSignals: normalizedList(source.interactionSignals, 12),
    objects: normalizedList(source.objects, 15),
    ocr: normalizedList(source.ocr, 20),
    scenes: normalizedList(source.scenes, 8),
    styles: normalizedList(source.styles, 8),
    tools: normalizedList(source.tools, 10),
  };
}

function completedStage({ completedAt, inputHash, model = null, version }) {
  return { completedAt, inputHash, model, status: "complete", version };
}

export function prepareCurationItem(item, { now = new Date() } = {}) {
  const completedAt = asIsoDate(now);
  const inputHash = curationInputHash(item);
  const visualHash = curationVisualHash(item);
  const previous = item.pipeline ?? {};
  const previousStages = previous.stages ?? {};
  const stages = { ...previousStages };

  if (
    stages.facts?.status !== "complete"
      || stages.facts.version !== FACTS_STAGE_VERSION
      || stages.facts.inputHash !== inputHash
  ) {
    stages.facts = completedStage({ completedAt, inputHash, version: FACTS_STAGE_VERSION });
  }
  if (!stages.editorial && item.ai?.enrichedAt) {
    stages.editorial = completedStage({
      completedAt: item.ai.enrichedAt,
      inputHash,
      model: "legacy",
      version: 1,
    });
  }
  if (!stages.visual && item.ai?.visualFacts) {
    stages.visual = completedStage({ completedAt: item.ai.enrichedAt ?? completedAt, inputHash: visualHash, version: 1 });
  }
  if (!stages.design && item.ai?.design) {
    stages.design = completedStage({ completedAt: item.ai.design.classifiedAt ?? completedAt, inputHash, version: 1 });
  }

  return {
    ...item,
    facts: extractCurationFacts(item),
    pipeline: {
      inputHash,
      stages,
      version: ANALYSIS_PIPELINE_VERSION,
      visualHash,
    },
  };
}

export function needsCurationAnalysis(item, { refresh = false } = {}) {
  if (!item.ai?.enrichedAt) return true;
  const stage = item.pipeline?.stages?.editorial;
  if (stage && (stage.status !== "complete" || stage.inputHash !== item.pipeline.inputHash)) return true;
  return Boolean(refresh && (
    Number(stage?.version ?? 0) < EDITORIAL_STAGE_VERSION
      || !item.ai.searchSignals
      || ((item.media?.length ?? 0) > 0 && !item.ai.visualFacts)
  ));
}

export function hasReusableVisualFacts(item) {
  const stage = item.pipeline?.stages?.visual;
  return Boolean(
    item.ai?.visualFacts
      && stage?.status === "complete"
      && stage.inputHash === item.pipeline?.visualHash,
  );
}

export function applyCurationAnalysis(item, result, {
  completedAt = new Date(),
  model,
  visualEvidenceCount = 0,
} = {}) {
  const prepared = prepareCurationItem(item, { now: completedAt });
  const timestamp = asIsoDate(completedAt);
  const visualFacts = normalizeVisualFacts(result.visualFacts ?? prepared.ai?.visualFacts);
  const hasVisualFacts = Object.values(visualFacts).some((values) => values.length > 0);
  return {
    ...prepared,
    ai: {
      ...prepared.ai,
      analysis: String(result.analysis),
      design: { ...result.design, classifiedAt: timestamp },
      enrichedAt: timestamp,
      searchSignals: normalizeSearchSignals(result.searchSignals ?? prepared.ai?.searchSignals),
      summary: String(result.summary),
      tags: normalizedList(result.tags, 2),
      title: String(result.title),
      visualFacts,
    },
    pipeline: {
      ...prepared.pipeline,
      stages: {
        ...prepared.pipeline.stages,
        design: completedStage({ completedAt: timestamp, inputHash: prepared.pipeline.inputHash, model, version: DESIGN_STAGE_VERSION }),
        editorial: completedStage({ completedAt: timestamp, inputHash: prepared.pipeline.inputHash, model, version: EDITORIAL_STAGE_VERSION }),
        visual: visualEvidenceCount > 0 || hasVisualFacts
          ? completedStage({ completedAt: timestamp, inputHash: prepared.pipeline.visualHash, model, version: VISUAL_STAGE_VERSION })
          : { completedAt: timestamp, inputHash: prepared.pipeline.visualHash, model, status: "skipped", version: VISUAL_STAGE_VERSION },
      },
    },
  };
}

export function applyDesignAnalysis(item, design, { completedAt = new Date(), model } = {}) {
  const prepared = prepareCurationItem(item, { now: completedAt });
  const timestamp = asIsoDate(completedAt);
  return {
    ...prepared,
    ai: { ...prepared.ai, design: { ...design, classifiedAt: timestamp } },
    pipeline: {
      ...prepared.pipeline,
      stages: {
        ...prepared.pipeline.stages,
        design: completedStage({ completedAt: timestamp, inputHash: prepared.pipeline.inputHash, model, version: DESIGN_STAGE_VERSION }),
      },
    },
  };
}

export function recordCurationAnalysisFailure(item, error, { attemptedAt = new Date(), model } = {}) {
  const prepared = prepareCurationItem(item, { now: attemptedAt });
  const previous = prepared.pipeline.stages.editorial;
  return {
    ...prepared,
    pipeline: {
      ...prepared.pipeline,
      stages: {
        ...prepared.pipeline.stages,
        editorial: {
          attempts: Number(previous?.attempts ?? 0) + 1,
          error: String(error?.message ?? error).slice(0, 500),
          inputHash: prepared.pipeline.inputHash,
          lastAttemptedAt: asIsoDate(attemptedAt),
          model,
          status: "error",
          version: EDITORIAL_STAGE_VERSION,
        },
      },
    },
  };
}
