// A refresh must not discard local edits or apply an older in-flight response.
export function reconcileHistory(local, remote) {
  const remoteById = new Map(remote.map(item => [item.id, item]));
  for (const item of local) {
    const incoming = remoteById.get(item.id);
    if (!item.synced || (incoming && item.timestamp > incoming.timestamp)) {
      remoteById.set(item.id, item);
    }
  }
  return [...remoteById.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function sameHistoryRevision(a, b) {
  return a.id === b.id && a.timestamp === b.timestamp && JSON.stringify(a.data) === JSON.stringify(b.data);
}

export function retainHistory(items, limit = 100) {
  let visible = 0;
  return items.filter(item => item.toolId === '__seq_analyzer_library__' || ++visible <= limit);
}

export function reconcileVisibleHistory(local, remote) {
  const libraryItems = local.filter(item => item.toolId === '__seq_analyzer_library__');
  const visibleItems = local.filter(item => item.toolId !== '__seq_analyzer_library__');
  return retainHistory(
    [...reconcileHistory(visibleItems, remote), ...libraryItems]
      .sort((a, b) => b.timestamp - a.timestamp)
  );
}

export function applyRemoteHistoryChange(local, change) {
  if (change.eventType === 'DELETE') {
    return local.filter(item => item.id !== change.id || !item.synced);
  }
  if (!change.item) return local;
  const existing = local.find(item => item.id === change.item.id);
  if (existing && (!existing.synced || existing.timestamp > change.item.timestamp)) return local;
  return retainHistory(
    [change.item, ...local.filter(item => item.id !== change.item.id)]
      .sort((a, b) => b.timestamp - a.timestamp)
  );
}

export function shouldRunCatchUp(lastStartedAt, now, minimumIntervalMs) {
  return !lastStartedAt || now - lastStartedAt >= minimumIntervalMs;
}
