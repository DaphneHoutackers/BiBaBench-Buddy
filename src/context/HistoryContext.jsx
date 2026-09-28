import {
  applyRemoteHistoryChange,
  reconcileVisibleHistory,
  sameHistoryRevision,
  shouldRunCatchUp,
  retainHistory,
} from '@/lib/historySync';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { makeId } from '@/utils/makeId';
import { useAuth } from '@/lib/AuthContext';

const HistoryContext = createContext(null);
const LOCAL_STORAGE_KEY = 'bibabenchbuddy_tool_history';
const HIDDEN_HISTORY_TOOL_IDS = new Set(['__seq_analyzer_library__']);
const HISTORY_COLUMNS = 'id,toolid,toolname,timestamp,data';
const ACCOUNT_STATE_PREFIX = '__account_state__:';
const CATCH_UP_INTERVAL_MS = 60_000;
const FORCED_CATCH_UP_DEDUPE_MS = 2_000;


function normalizeRemoteItem(row) {
  const ts = row.timestamp || Date.now();
  return {
    id: row.id,
    toolId: row.toolid,
    toolName: row.toolname,
    timestamp: ts,
    createdAt: new Date(ts).toISOString(),
    data: row.data,
    synced: true,
  };
}

function buildRemoteRow(item, userId) {
  const ts = item.timestamp || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now());

  return {
    id: item.id || makeId(),
    user_id: userId,
    toolid: item.toolId,
    toolname: item.toolName,
    timestamp: ts,
    data: item.data,
  };
}

function deduplicateHistory(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.filter((item) => {
    if (!item) return false;
    if (HIDDEN_HISTORY_TOOL_IDS.has(item.toolId)) return true;

    // Deduplicate identical preview + tool content
    const preview = item.data?.preview || '';
    const key = `${item.toolId}_${preview}_${JSON.stringify(item.data || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function HistoryProvider({ children }) {
  const { user } = useAuth();
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);

  const getStorageKey = useCallback(() => {
    return user ? `${LOCAL_STORAGE_KEY}_${user.id}` : LOCAL_STORAGE_KEY;
  }, [user?.id]);

  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;
  const historyLoadRef = useRef(null);
  const lastHistoryLoadStartedAtRef = useRef(0);
  const sequenceLibraryLoadRef = useRef(null);
  const lastSequenceLibraryLoadStartedAtRef = useRef(0);
  const sequenceLibraryRequestedAccountRef = useRef(null);
  const sequenceLibraryReadyForRef = useRef(null);
  const [sequenceLibraryReadyFor, setSequenceLibraryReadyFor] = useState(null);

  const uploadQueueRef = useRef(Promise.resolve());
  const [syncError, setSyncError] = useState(null);
  const uploadRows = useCallback((rows) => {
    const accountId = user?.id;
    const task = uploadQueueRef.current.catch(() => {}).then(async () => {
      if (!accountId || accountRef.current !== accountId) throw new Error('Account changed; sign in and save again.');
      const controller = new AbortController();
      let timer;
      try {
        const response = await Promise.race([
          supabase.from('tool_history').upsert(rows, { onConflict: 'id' }).abortSignal(controller.signal),
          new Promise((_, reject) => { timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Saving timed out. Your edits are kept on this device; try Save again.'));
          }, 12000); }),
        ]);
        if (response.error) throw response.error;
      } finally { clearTimeout(timer); }
    });
    uploadQueueRef.current = task;
    return task;
  }, [user?.id]);

  const loadRemoteHistory = useCallback((currentLocalHistory = [], { force = false } = {}) => {
    if (!isSyncEnabled() || !user) return Promise.resolve(false);
    const accountId = user.id;
    if (historyLoadRef.current?.accountId === accountId) return historyLoadRef.current.promise;

    const now = Date.now();
    const minimumInterval = force ? FORCED_CATCH_UP_DEDUPE_MS : CATCH_UP_INTERVAL_MS;
    if (!shouldRunCatchUp(lastHistoryLoadStartedAtRef.current, now, minimumInterval)) {
      return Promise.resolve(false);
    }
    lastHistoryLoadStartedAtRef.current = now;

    const promise = (async () => {
      const unsynced = Array.isArray(currentLocalHistory)
        ? currentLocalHistory.filter(item => !item.synced)
        : [];

      if (unsynced.length > 0) {
        await uploadRows(unsynced.map(item => buildRemoteRow(item, accountId)));
      }

      const { data, error } = await supabase
        .from('tool_history')
        .select(HISTORY_COLUMNS)
        .eq('user_id', accountId)
        .neq('toolid', '__seq_analyzer_library__')
        .not('toolid', 'like', `${ACCOUNT_STATE_PREFIX}%`)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!data || accountRef.current !== accountId) return false;

      const normalized = deduplicateHistory(
        data.map(normalizeRemoteItem).sort((a, b) => b.timestamp - a.timestamp)
      );
      setHistory(prev => reconcileVisibleHistory(prev, normalized));
      setSyncError(null);
      return true;
    })().catch(error => {
      if (accountRef.current === accountId) setSyncError(error.message || 'Sync failed');
      return false;
    }).finally(() => {
      if (historyLoadRef.current?.promise === promise) historyLoadRef.current = null;
    });

    historyLoadRef.current = { accountId, promise };
    return promise;
  }, [user?.id, uploadRows]);

  const loadSequenceLibrary = useCallback(({ force = false } = {}) => {
    if (!isSyncEnabled() || !user) return Promise.resolve(false);
    const accountId = user.id;
    sequenceLibraryRequestedAccountRef.current = accountId;
    if (!force && sequenceLibraryReadyForRef.current === accountId) return Promise.resolve(true);
    if (sequenceLibraryLoadRef.current?.accountId === accountId) return sequenceLibraryLoadRef.current.promise;
    const now = Date.now();
    if (force && !shouldRunCatchUp(lastSequenceLibraryLoadStartedAtRef.current, now, FORCED_CATCH_UP_DEDUPE_MS)) {
      return Promise.resolve(false);
    }
    lastSequenceLibraryLoadStartedAtRef.current = now;

    const promise = (async () => {
      const { data, error } = await supabase
        .from('tool_history')
        .select(HISTORY_COLUMNS)
        .eq('user_id', accountId)
        .eq('toolid', '__seq_analyzer_library__')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data && accountRef.current === accountId) {
        const item = normalizeRemoteItem(data);
        setHistory(prev => applyRemoteHistoryChange(prev, { eventType: 'UPDATE', item }));
      }
      return true;
    })().catch(error => {
      console.warn('Sequence library sync failed; using the local copy:', error);
      return false;
    }).finally(() => {
      if (accountRef.current === accountId) {
        sequenceLibraryReadyForRef.current = accountId;
        setSequenceLibraryReadyFor(accountId);
      }
      if (sequenceLibraryLoadRef.current?.promise === promise) sequenceLibraryLoadRef.current = null;
    });

    sequenceLibraryLoadRef.current = { accountId, promise };
    return promise;
  }, [user?.id]);

  // Load history whenever user changes
  useEffect(() => {
    if (!user) {
      setHistory([]);
      setIsRemoteLoading(false);
      setSequenceLibraryReadyFor(null);
      sequenceLibraryReadyForRef.current = null;
      sequenceLibraryRequestedAccountRef.current = null;
      return;
    }
    const key = getStorageKey();
    let localHistory = [];
    try {
      const saved = localStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : [];
      localHistory = deduplicateHistory(parsed);
      setHistory(localHistory);
    } catch {
      setHistory([]);
    }

    lastHistoryLoadStartedAtRef.current = 0;
    lastSequenceLibraryLoadStartedAtRef.current = 0;
    setSequenceLibraryReadyFor(null);
    sequenceLibraryReadyForRef.current = null;
    sequenceLibraryRequestedAccountRef.current = null;
    setIsRemoteLoading(true);
    loadRemoteHistory(localHistory, { force: true }).finally(() => {
      if (accountRef.current === user.id) setIsRemoteLoading(false);
    });
  }, [user?.id, getStorageKey, loadRemoteHistory]);

  // Keep a ref of history for reliable access in async callbacks
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Realtime applies only the changed row. A throttled catch-up after foregrounding,
  // reconnecting, or coming online covers missed events without background polling.
  useEffect(() => {
    if (!user || !isSyncEnabled()) return undefined;
    const accountId = user.id;
    let hasSubscribed = false;
    const catchUp = ({ force = false } = {}) => {
      loadRemoteHistory(historyRef.current, { force });
      if (sequenceLibraryRequestedAccountRef.current === accountId) {
        loadSequenceLibrary({ force });
      }
    };
    const applyChange = payload => {
      const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
      if (!row?.id || (row.user_id && row.user_id !== accountId)) return;
      if (String(row.toolid || '').startsWith(ACCOUNT_STATE_PREFIX)) return;
      if (row.toolid === '__seq_analyzer_library__' && sequenceLibraryRequestedAccountRef.current !== accountId) return;

      if (payload.eventType === 'DELETE') {
        setHistory(prev => applyRemoteHistoryChange(prev, { eventType: 'DELETE', id: row.id }));
        return;
      }
      const item = normalizeRemoteItem(row);
      setHistory(prev => deduplicateHistory(
        applyRemoteHistoryChange(prev, { eventType: payload.eventType, item })
      ));
    };
    const channel = supabase.channel(`tool-history-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tool_history', filter: `user_id=eq.${user.id}` }, applyChange)
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        if (hasSubscribed) catchUp({ force: true });
        hasSubscribed = true;
      });
    const onVisibility = () => { if (document.visibilityState === 'visible') catchUp(); };
    const onOnline = () => catchUp({ force: true });
    const onFocus = () => catchUp();
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadRemoteHistory, loadSequenceLibrary]);

  useEffect(() => {
    if (!history || history.length === 0 && !user) return;

    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to persist history locally:', err);
    }

    const syncTimeout = setTimeout(async () => {
      if (!isSyncEnabled() || !user) return;

      const unsynced = history.filter((item) => !item.synced);
      if (unsynced.length === 0) return;

      const rows = unsynced.map((item) => buildRemoteRow(item, user.id));

      try {
        await uploadRows(rows);
        if (accountRef.current !== user.id) return;
        setSyncError(null);
        setHistory((prev) =>
          prev.map((item) => {
            if (!unsynced.some((u) => sameHistoryRevision(u, item))) return item;
            const createdAt = item.createdAt
              ? item.createdAt
              : item.timestamp
                ? new Date(item.timestamp).toISOString()
                : new Date().toISOString();

            return {
              ...item,
              createdAt,
              timestamp: item.timestamp,
              synced: true,
            };
          })
        );
      } catch (error) { setSyncError(error.message || 'Sync failed'); }
    }, 150);

    return () => clearTimeout(syncTimeout);
  }, [history, user, getStorageKey, uploadRows]);

  const addHistoryItem = useCallback((item) => {
    setHistory((prev) => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const normalizedItem = {
        id: item.id || makeId(),
        toolId: item.toolId,
        toolName: item.toolName,
        data: item.data,
        createdAt: item.createdAt || nowIso,
        timestamp: now,
        synced: false,
      };

      // Find matching item by ID, or by identical tool and data payload
      const existingIndex = prev.findIndex((entry) => {
        if (entry.id === normalizedItem.id) return true;
        if (
          !HIDDEN_HISTORY_TOOL_IDS.has(entry.toolId) &&
          entry.toolId === normalizedItem.toolId &&
          (entry.data?.preview === normalizedItem.data?.preview || !entry.data?.preview) &&
          JSON.stringify(entry.data) === JSON.stringify(normalizedItem.data)
        ) {
          return true;
        }
        return false;
      });

      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          ...normalizedItem,
          id: existing.id,
          createdAt: existing.createdAt,
          timestamp: now,
          synced: false,
        };

        return retainHistory(updated.sort((a, b) => b.timestamp - a.timestamp));
      }

      return retainHistory([normalizedItem, ...prev].sort((a, b) => b.timestamp - a.timestamp));
    });
  }, []);

  const saveHistoryItems = useCallback(async (items) => {
    const accountId = user?.id;
    const now = Date.now();
    const revisions = items.map(item => ({ ...item, id: item.id || makeId(), timestamp: now, createdAt: new Date(now).toISOString(), synced: false }));
    const ids = new Set(revisions.map(item => item.id));
    const next = retainHistory([...revisions, ...historyRef.current.filter(item => !ids.has(item.id))].sort((a, b) => b.timestamp - a.timestamp));
    historyRef.current = next;
    setHistory(next);
    localStorage.setItem(getStorageKey(), JSON.stringify(next));
    if (!accountId || !isSyncEnabled()) throw new Error('Account sync is unavailable. Your edits are saved on this device.');
    try {
      await uploadRows(revisions.map(item => buildRemoteRow(item, accountId)));
      if (accountRef.current !== accountId) throw new Error('Account changed during save.');
      setHistory(prev => prev.map(item => revisions.some(sent => sameHistoryRevision(sent, item)) ? { ...item, synced: true } : item));
      setSyncError(null);
    } catch (error) {
      setSyncError(error.message || 'Save failed');
      throw error;
    }
  }, [user?.id, getStorageKey, uploadRows]);

  const deleteHistoryItem = useCallback(async (id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));

    if (!isSyncEnabled()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    await supabase
      .from('tool_history')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory((prev) => prev.filter((item) => HIDDEN_HISTORY_TOOL_IDS.has(item.toolId)));
    try {
      const hiddenItems = historyRef.current.filter((item) => HIDDEN_HISTORY_TOOL_IDS.has(item.toolId));
      if (hiddenItems.length > 0) {
        localStorage.setItem(getStorageKey(), JSON.stringify(hiddenItems));
      } else {
        localStorage.removeItem(getStorageKey());
      }
    } catch {
      localStorage.removeItem(getStorageKey());
    }

    if (!isSyncEnabled()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    await supabase
      .from('tool_history')
      .delete()
      .eq('user_id', session.user.id)
      .neq('toolid', '__seq_analyzer_library__');
  }, [getStorageKey]);

  return (
    <HistoryContext.Provider
      value={{
        history,
        user,
        isRemoteLoading,
        addHistoryItem,
        saveHistoryItems,
        syncError,
        isSequenceLibraryReady: !user || sequenceLibraryReadyFor === user.id,
        loadSequenceLibrary,
        deleteHistoryItem,
        clearHistory,
        reloadHistory: () => loadRemoteHistory(historyRef.current, { force: true }),
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
