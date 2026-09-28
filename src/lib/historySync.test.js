import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRemoteHistoryChange,
  reconcileHistory,
  reconcileVisibleHistory,
  sameHistoryRevision,
  shouldRunCatchUp,
  retainHistory,
} from './historySync.js';

test('remote refresh preserves pending edits and includes another device additions', () => {
  const draft = { id: 'a', timestamp: 20, synced: false, data: { name: 'edited' } };
  const old = { ...draft, timestamp: 10, synced: true, data: { name: 'old' } };
  const added = { id: 'b', timestamp: 30, synced: true };
  assert.deepEqual(reconcileHistory([draft], [old, added]), [added, draft]);
});

test('late read cannot roll back an acknowledged revision; newer remote edits apply', () => {
  const current = { id: 'a', timestamp: 20, synced: true };
  assert.deepEqual(reconcileHistory([current], [{ ...current, timestamp: 10 }]), [current]);
  const updated = { ...current, timestamp: 30 };
  assert.deepEqual(reconcileHistory([current], [updated]), [updated]);
});

test('upload acknowledgement does not mark an edit made during the upload as synced', () => {
  const sent = { id: 'a', timestamp: 20, data: { sequence: 'ATGC' } };
  assert.equal(sameHistoryRevision(sent, { ...sent, data: { sequence: 'ATGA' } }), false);
  assert.equal(sameHistoryRevision(sent, { ...sent }), true);
});

test('history limit never evicts the account library', () => {
  const library = { id: 'library', toolId: '__seq_analyzer_library__' };
  const items = Array.from({ length: 110 }, (_, i) => ({ id: String(i), toolId: 'plasmid' }));
  const retained = retainHistory([...items, library]);
  assert.equal(retained.length, 101);
  assert.ok(retained.includes(library));
});

test('visible history refresh keeps an already loaded sequence library', () => {
  const library = { id: 'library', toolId: '__seq_analyzer_library__', timestamp: 5, synced: true };
  const stale = { id: 'old', toolId: 'pcr', timestamp: 10, synced: true };
  const remote = { id: 'new', toolId: 'pcr', timestamp: 20, synced: true };
  assert.deepEqual(reconcileVisibleHistory([stale, library], [remote]), [remote, library]);
});

test('realtime changes update only the changed record and preserve pending local edits', () => {
  const first = { id: 'a', toolId: 'pcr', timestamp: 10, synced: true, data: { value: 1 } };
  const second = { id: 'b', toolId: 'buffer', timestamp: 20, synced: true };
  const updated = { ...first, timestamp: 30, data: { value: 2 } };
  assert.deepEqual(
    applyRemoteHistoryChange([second, first], { eventType: 'UPDATE', item: updated }),
    [updated, second]
  );

  const pending = { ...updated, timestamp: 40, synced: false, data: { value: 3 } };
  assert.deepEqual(
    applyRemoteHistoryChange([pending, second], { eventType: 'UPDATE', item: updated }),
    [pending, second]
  );
});

test('realtime deletes remove synced records but never discard an unsynced local edit', () => {
  const synced = { id: 'a', timestamp: 10, synced: true };
  const pending = { id: 'b', timestamp: 20, synced: false };
  assert.deepEqual(
    applyRemoteHistoryChange([pending, synced], { eventType: 'DELETE', id: 'a' }),
    [pending]
  );
  assert.deepEqual(
    applyRemoteHistoryChange([pending], { eventType: 'DELETE', id: 'b' }),
    [pending]
  );
});

test('focus and visibility catch-up requests are throttled without blocking reconnects', () => {
  assert.equal(shouldRunCatchUp(1_000, 20_000, 60_000), false);
  assert.equal(shouldRunCatchUp(1_000, 61_000, 60_000), true);
  assert.equal(shouldRunCatchUp(0, 1_000, 60_000), true);
});
