const RELATIONSHIP_ORDER = ["owned", "starred", "watched"];

function isoTimestamp(value, fallback = null) {
  const milliseconds = Date.parse(String(value ?? ""));
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : fallback;
}

function nullableString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function sortedStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function sortRelationships(values) {
  const relationships = new Set(values);
  return RELATIONSHIP_ORDER.filter((relationship) => relationships.has(relationship));
}

function normalizeLicense(value) {
  if (!value || typeof value !== "object") return null;
  return {
    key: nullableString(value.key),
    name: nullableString(value.name),
    spdx_id: nullableString(value.spdx_id),
    url: nullableString(value.url),
  };
}

export function normalizeRepository(value) {
  const sourceId = String(value?.id ?? "");
  if (!/^\d+$/u.test(sourceId)) throw new Error("github-repository-id-must-be-numeric");
  const fullName = nullableString(value.full_name);
  const name = nullableString(value.name);
  const ownerLogin = nullableString(value.owner?.login);
  if (!fullName || !name || !ownerLogin) throw new Error(`github-repository-identity-incomplete:${sourceId}`);
  return {
    id: sourceId,
    node_id: nullableString(value.node_id),
    name,
    full_name: fullName,
    owner: {
      login: ownerLogin,
      id: String(value.owner?.id ?? ""),
      type: nullableString(value.owner?.type),
    },
    html_url: nullableString(value.html_url) ?? `https://github.com/${fullName}`,
    description: nullableString(value.description),
    homepage: nullableString(value.homepage),
    private: Boolean(value.private),
    visibility: nullableString(value.visibility) ?? (value.private ? "private" : "public"),
    fork: Boolean(value.fork),
    archived: Boolean(value.archived),
    disabled: Boolean(value.disabled),
    is_template: Boolean(value.is_template),
    default_branch: nullableString(value.default_branch),
    language: nullableString(value.language),
    topics: sortedStrings(value.topics),
    license: normalizeLicense(value.license),
    stargazers_count: finiteNumber(value.stargazers_count),
    forks_count: finiteNumber(value.forks_count),
    watchers_count: finiteNumber(value.watchers_count),
    open_issues_count: finiteNumber(value.open_issues_count),
    size: finiteNumber(value.size),
    has_issues: Boolean(value.has_issues),
    has_projects: Boolean(value.has_projects),
    has_wiki: Boolean(value.has_wiki),
    has_pages: Boolean(value.has_pages),
    has_downloads: Boolean(value.has_downloads),
    has_discussions: Boolean(value.has_discussions),
    created_at: isoTimestamp(value.created_at),
    updated_at: isoTimestamp(value.updated_at),
    pushed_at: isoTimestamp(value.pushed_at),
  };
}

export function repositoryConceptId(sourceId) {
  const id = String(sourceId ?? "");
  if (!/^\d+$/u.test(id)) throw new Error("github-concept-id-must-be-numeric");
  return `/github/repositories/${id}.md`;
}

export function mergeRepositoryCollections({ owned = [], starred = [], watched = [] }) {
  const repositories = new Map();
  const ingest = (rawValue, relationship, priority, starredAt = null) => {
    const repository = normalizeRepository(rawValue);
    const existing = repositories.get(repository.id) ?? {
      sourceId: repository.id,
      repository,
      repositoryPriority: -1,
      relationships: new Set(),
      starredAt: null,
    };
    if (priority >= existing.repositoryPriority) {
      existing.repository = repository;
      existing.repositoryPriority = priority;
    }
    existing.relationships.add(relationship);
    if (relationship === "starred") existing.starredAt = isoTimestamp(starredAt);
    repositories.set(repository.id, existing);
  };

  for (const item of watched) ingest(item, "watched", 1);
  for (const item of starred) ingest(item?.repo ?? item, "starred", 2, item?.starred_at);
  for (const item of owned) ingest(item, "owned", 3);

  return [...repositories.values()]
    .map((entry) => ({
      sourceId: entry.sourceId,
      repository: entry.repository,
      relationships: sortRelationships(entry.relationships),
      starredAt: entry.starredAt,
      active: true,
      firstSeenAt: null,
      lastChangedAt: null,
      inactiveSince: null,
      previousRelationships: [],
      remoteStatus: "available",
      readme: null,
    }))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en", { numeric: true }));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function relationshipDifference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function changeRecord({
  sourceId,
  added = false,
  metadataUpdated = false,
  relationshipMetadataUpdated = false,
  deactivated = false,
  reactivated = false,
  relationshipsAdded = [],
  relationshipsRemoved = [],
}) {
  return {
    sourceId,
    added,
    metadataUpdated,
    relationshipMetadataUpdated,
    deactivated,
    reactivated,
    relationshipsAdded,
    relationshipsRemoved,
  };
}

export function planInventoryUpdate({ current, previous = [], observedAt }) {
  const timestamp = isoTimestamp(observedAt);
  if (!timestamp) throw new Error("github-observed-at-invalid");
  const currentById = new Map(current.map((record) => [record.sourceId, record]));
  const previousById = new Map(previous.map((record) => [record.sourceId, record]));
  const sourceIds = [...new Set([...currentById.keys(), ...previousById.keys()])]
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  const records = [];
  const changes = [];

  for (const sourceId of sourceIds) {
    const currentRecord = currentById.get(sourceId);
    const previousRecord = previousById.get(sourceId);
    if (currentRecord && !previousRecord) {
      records.push({
        ...currentRecord,
        firstSeenAt: timestamp,
        lastChangedAt: timestamp,
      });
      changes.push(changeRecord({
        sourceId,
        added: true,
        relationshipsAdded: currentRecord.relationships,
      }));
      continue;
    }

    if (!currentRecord && previousRecord) {
      if (!previousRecord.active) {
        records.push(previousRecord);
        continue;
      }
      records.push({
        ...previousRecord,
        relationships: [],
        starredAt: null,
        active: false,
        lastChangedAt: timestamp,
        inactiveSince: timestamp,
        previousRelationships: previousRecord.relationships,
        remoteStatus: previousRecord.remoteStatus ?? "unknown",
      });
      changes.push(changeRecord({
        sourceId,
        deactivated: true,
        relationshipsRemoved: previousRecord.relationships,
      }));
      continue;
    }

    const metadataUpdated = !sameValue(currentRecord.repository, previousRecord.repository)
      || !sameValue(currentRecord.readme, previousRecord.readme);
    const relationshipsAdded = relationshipDifference(currentRecord.relationships, previousRecord.relationships);
    const relationshipsRemoved = relationshipDifference(previousRecord.relationships, currentRecord.relationships);
    const relationshipMetadataUpdated = currentRecord.starredAt !== previousRecord.starredAt;
    const reactivated = !previousRecord.active;
    const changed = metadataUpdated || relationshipMetadataUpdated || reactivated
      || relationshipsAdded.length > 0 || relationshipsRemoved.length > 0;
    records.push({
      ...currentRecord,
      firstSeenAt: previousRecord.firstSeenAt,
      lastChangedAt: changed ? timestamp : previousRecord.lastChangedAt,
      inactiveSince: null,
      previousRelationships: [],
    });
    if (changed) {
      changes.push(changeRecord({
        sourceId,
        metadataUpdated,
        relationshipMetadataUpdated,
        reactivated,
        relationshipsAdded,
        relationshipsRemoved,
      }));
    }
  }

  return { records, changes };
}
