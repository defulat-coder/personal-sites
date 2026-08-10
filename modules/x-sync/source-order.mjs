export function parseSourceOrderSnapshot(snapshot, source) {
  if (!snapshot || snapshot.source !== source || !Array.isArray(snapshot.ids)) {
    throw new Error("--source-order-file 与当前抓取来源不匹配或内容无效。");
  }
  const capturedAt = new Date(snapshot.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) {
    throw new Error("--source-order-file 缺少有效的 capturedAt。");
  }
  return {
    capturedAt: capturedAt.toISOString(),
    positions: new Map(snapshot.ids.map((id, index) => [String(id), index])),
  };
}

export function firstSeenMetadata({ itemId, sourceOrder }) {
  const firstSeenOrder = sourceOrder?.positions.get(String(itemId));
  if (firstSeenOrder === undefined) return null;

  return {
    firstSeenAt: sourceOrder.capturedAt,
    firstSeenOrder,
  };
}
