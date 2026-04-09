import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { makeId } from '@/utils/makeId';

const HistoryContext = createContext(null);
const LOCAL_STORAGE_KEY = 'bibabenchbuddy_tool_history';


function normalizeRemoteItem(row) {
  return {
    id: row.id,
    toolId: row.tool_id,
    toolName: row.tool_name,
    timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    createdAt: row.created_at,
    data: row.data,
    synced: true,
  };
}

function buildRemoteRow(item, userId) {
  const createdAt = item.createdAt
    ? item.createdAt
    : item.timestamp
      ? new Date(item.timestamp).toISOString()
      : new Date().toISOString();

  return {
    id: item.id || makeId(),
    user_id: userId,
    tool_id: item.toolId,
    tool_name: item.toolName,
    created_at: createdAt,
    data: item.data,
    synced: true,
  };
}

export function HistoryProvider({ children }) {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep a ref of history for reliable access in async callbacks (like auth changes) 
  // without triggering effect re-subscriptions
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const loadRemoteHistory = useCallback(async (currentLocalHistory = []) => {
    if (!isSyncEnabled()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    // 1. If there's local unsynced history, upload it to the new account first
    const unsynced = Array.isArray(currentLocalHistory)
      ? currentLocalHistory.filter(item => !item.synced)
      : [];

    if (unsynced.length > 0) {
      const rows = unsynced.map(item => buildRemoteRow(item, session.user.id));
      await supabase.from('tool_history').upsert(rows, { onConflict: 'id' });
    }

    // 2. Fetch all history for this account
    const { data, error } = await supabase
      .from('tool_history')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return;

    const normalized = data.map(normalizeRemoteItem);

    setHistory(normalized);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      console.warn('Failed to persist remote history locally:', err);
    }
  }, []);

  useEffect(() => {
    if (!isSyncEnabled()) return;

    // Initial load on mount
    loadRemoteHistory();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        // Pass current (possibly unsynced) history to loadRemoteHistory for merging
        await loadRemoteHistory(historyRef.current);
      }

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        // Clear history on sign out for account-based privacy
        setHistory([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadRemoteHistory]);


  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to persist history locally:', err);
    }

    const syncTimeout = setTimeout(async () => {
      if (!isSyncEnabled()) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const unsynced = history.filter((item) => !item.synced);
      if (unsynced.length === 0) return;

      const rows = unsynced.map((item) => buildRemoteRow(item, session.user.id));

      const { error } = await supabase
        .from('tool_history')
        .upsert(rows, { onConflict: 'id' });

      if (!error) {
        setHistory((prev) =>
          prev.map((item) => {
            if (!unsynced.some((u) => u.id === item.id)) return item;
            const createdAt = item.createdAt
              ? item.createdAt
              : item.timestamp
                ? new Date(item.timestamp).toISOString()
                : new Date().toISOString();

            return {
              ...item,
              createdAt,
              timestamp: new Date(createdAt).getTime(),
              synced: true,
            };
          })
        );
      }
    }, 800);

    return () => clearTimeout(syncTimeout);
  }, [history]);

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

      const existingIndex = prev.findIndex((entry) => entry.id === normalizedItem.id);

      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...normalizedItem,
          // keep original createdAt so display date doesn't jump, but update timestamp for sort
          createdAt: updated[existingIndex].createdAt,
          timestamp: now,
        };

        return updated.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
      }

      return [normalizedItem, ...prev]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 100);
    });
  }, []);

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
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    if (!isSyncEnabled()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    await supabase
      .from('tool_history')
      .delete()
      .eq('user_id', session.user.id);
  }, []);

  return (
    <HistoryContext.Provider
      value={{
        history,
        addHistoryItem,
        deleteHistoryItem,
        clearHistory,
        reloadHistory: loadRemoteHistory,
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