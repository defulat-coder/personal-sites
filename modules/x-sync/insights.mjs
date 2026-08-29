function addCount(counts, value) {
  const key = String(value ?? "").trim();
  if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
}

function ranked(counts, limit = 12) {
  return [...counts.entries()]
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function itemDate(item) {
  const parsed = new Date(item.firstSeenAt ?? item.createdAt ?? "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function signalsFor(item) {
  return [...new Set([
    ...(item.ai?.searchSignals?.concepts ?? []),
    ...(item.ai?.searchSignals?.entities ?? []),
    ...(item.ai?.searchSignals?.tools ?? []),
    ...(item.facts?.tools ?? []),
  ])];
}

function sourceNames(item) {
  return item.facts?.sourceKinds?.length
    ? item.facts.sourceKinds
    : String(item.fetchSource ?? "unknown").split("+");
}

export function buildCurationInsights(items, { generatedAt = new Date() } = {}) {
  const generatedAtIso = new Date(generatedAt).toISOString();
  const validDates = items.map(itemDate).filter(Boolean);
  const referenceDate = validDates.length > 0
    ? new Date(Math.max(...validDates.map((date) => date.getTime())))
    : new Date(generatedAtIso);
  const recentStart = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(referenceDate.getTime() - 60 * 24 * 60 * 60 * 1000);
  const concepts = new Map();
  const recent = new Map();
  const previous = new Map();
  const conceptSources = new Map();
  const tags = new Map();
  const tools = new Map();
  const sources = new Map();
  const sourceProfiles = new Map();

  for (const item of items) {
    for (const tag of item.ai?.tags ?? []) addCount(tags, tag);
    for (const tool of new Set([...(item.facts?.tools ?? []), ...(item.ai?.searchSignals?.tools ?? [])])) addCount(tools, tool);
    const itemSources = [...new Set(sourceNames(item))];
    for (const source of itemSources) {
      addCount(sources, source);
      const profile = sourceProfiles.get(source) ?? { items: 0, tags: new Map(), tools: new Map() };
      profile.items += 1;
      for (const tag of new Set(item.ai?.tags ?? [])) addCount(profile.tags, tag);
      for (const tool of new Set([...(item.facts?.tools ?? []), ...(item.ai?.searchSignals?.tools ?? [])])) addCount(profile.tools, tool);
      sourceProfiles.set(source, profile);
    }
    const observedAt = itemDate(item);
    for (const signal of signalsFor(item)) {
      addCount(concepts, signal);
      const signalSources = conceptSources.get(signal) ?? new Set();
      for (const source of itemSources) signalSources.add(source);
      conceptSources.set(signal, signalSources);
      if (observedAt && observedAt >= recentStart) addCount(recent, signal);
      else if (observedAt && observedAt >= previousStart) addCount(previous, signal);
    }
  }

  const displayTags = new Set([...tags.keys()].map((tag) => tag.toLocaleLowerCase("en-US")));
  const emergingTopics = [...recent.entries()]
    .map(([name, count]) => ({ count, name, previousCount: previous.get(name) ?? 0 }))
    .filter((entry) => entry.count >= 2 && entry.count > entry.previousCount)
    .sort((left, right) => (right.count - right.previousCount) - (left.count - left.previousCount) || right.count - left.count)
    .slice(0, 10);

  return {
    generatedAt: generatedAtIso,
    crossSourceSignals: ranked(new Map(
      [...conceptSources.entries()]
        .filter(([, signalSources]) => signalSources.size > 1)
        .map(([name, signalSources]) => [name, signalSources.size]),
    ), 10),
    health: {
      analysisErrors: items.filter((item) => item.pipeline?.stages?.editorial?.status === "error").length,
      designReview: items.filter((item) => item.ai?.design?.status === "review").length,
      missingFacts: items.filter((item) => !item.facts).length,
      missingSearchSignals: items.filter((item) => !item.ai?.searchSignals).length,
      missingVisualFacts: items.filter((item) => (item.media?.length ?? 0) > 0 && !item.ai?.visualFacts).length,
    },
    referenceDate: referenceDate.toISOString(),
    sourceMix: ranked(sources),
    sourceProfiles: [...sourceProfiles.entries()]
      .map(([source, profile]) => ({
        items: profile.items,
        source,
        topTags: ranked(profile.tags, 5),
        topTools: ranked(profile.tools, 5),
      }))
      .sort((left, right) => right.items - left.items || left.source.localeCompare(right.source)),
    taxonomySuggestions: ranked(concepts, 30)
      .filter((entry) => entry.count >= 2 && !displayTags.has(entry.name.toLocaleLowerCase("en-US")))
      .slice(0, 10),
    topConcepts: ranked(concepts),
    topTags: ranked(tags),
    topTools: ranked(tools),
    emergingTopics,
    totals: {
      analyzed: items.filter((item) => item.ai?.enrichedAt).length,
      items: items.length,
      withMedia: items.filter((item) => (item.media?.length ?? 0) > 0).length,
    },
    version: 1,
  };
}
