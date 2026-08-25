export const DESIGN_CATEGORIES = [
  "UI/UX",
  "交互设计",
  "动效设计",
  "视觉设计",
  "品牌设计",
  "字体与排版",
  "设计系统",
  "产品设计",
  "3D/空间设计",
];

export const DESIGN_INCLUDE_THRESHOLD = 0.75;

export function designClassificationStatus(relevant, confidence) {
  if (confidence < DESIGN_INCLUDE_THRESHOLD) return "review";
  return relevant ? "include" : "exclude";
}

function cleanStrings(values, limit) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

export function normalizeDesignClassification(value, classifiedAt = new Date().toISOString()) {
  if (!value || typeof value !== "object") throw new Error("模型返回缺少设计相关性判断");
  const relevant = value.relevant;
  const confidence = Number(value.confidence);
  if (typeof relevant !== "boolean" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("设计相关性判断的 relevant/confidence 无效");
  }

  const categories = cleanStrings(value.categories, 3);
  if (categories.some((category) => !DESIGN_CATEGORIES.includes(category))) {
    throw new Error("设计相关性判断包含未知分类");
  }
  if (relevant && categories.length === 0) throw new Error("设计相关内容至少需要一个分类");

  const evidence = cleanStrings(value.evidence, 4);
  const reason = String(value.reason ?? "").trim();
  if (!reason) throw new Error("设计相关性判断缺少理由");

  const status = designClassificationStatus(relevant, confidence);

  return { categories, classifiedAt, confidence, evidence, reason, relevant, status };
}

export function summarizeDesignClassifications(items) {
  return items.reduce((summary, item) => {
    const status = item.design?.status ?? "unclassified";
    summary[status] += 1;
    if (status === "include" && item.media?.some((media) => media.videoUrl)) {
      summary.playableVideos += 1;
    }
    return summary;
  }, { exclude: 0, include: 0, playableVideos: 0, review: 0, unclassified: 0 });
}
