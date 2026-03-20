import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSyncEnabled } from '@/lib/supabase';

const HistoryContext = createContext(null);

export function HistoryProvider({ children }) {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_tool_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastSynced, setLastSynced] = useState(0);

  // Sync with Supabase on Login
  useEffect(() => {
    if (!isSyncEnabled()) return;

    const syncRemoteHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('tool_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && data) {
        // Merge strategy: local + remote, remote wins for identical IDs
        setHistory(prev => {
          const merged = [...data];
          const itemIds = new Set(data.map(i => i.id));
          
          prev.forEach(item => {
            if (!itemIds.has(item.id)) {
              merged.push(item);
            }
          });

          return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
        });
      }
    };

    syncRemoteHistory();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') syncRemoteHistory();
      if (event === 'SIGNED_OUT') {
        const local = localStorage.getItem('bibabenchbuddy_tool_history');
        setHistory(local ? JSON.parse(local) : []);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update localStorage and Remote on history change
  useEffect(() => {
    localStorage.setItem('bibabenchbuddy_tool_history', JSON.stringify(history));

    const syncTimeout = setTimeout(async () => {
      if (!isSyncEnabled()) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Deep sync: In a real app we'd batch this or use a more efficient upsert
      // For this implementation, we upsert the latest items
      const unsynced = history.filter(item => !item.synced);
      if (unsynced.length > 0) {
        const { error } = await supabase
          .from('tool_history')
          .upsert(unsynced.map(i => ({ ...i, user_id: session.user.id, synced: true })));
        
        if (!error) {
          setHistory(prev => prev.map(item => ({ ...item, synced: true })));
        }
      }
    }, 2000);

    return () => clearTimeout(syncTimeout);
  }, [history]);

  const addHistoryItem = useCallback((item) => {
    setHistory(prev => {
      const isDuplicate = prev.length > 0 && 
        prev[0].toolId === item.toolId && 
        JSON.stringify(prev[0].data) === JSON.stringify(item.data);
      
      if (isDuplicate) return prev;

      const newItem = {
        ...item,
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
        timestamp: item.timestamp || Date.now(),
        synced: false,
      };
      
      return [newItem, ...prev].slice(0, 50);
    });
  }, []);

  const deleteHistoryItem = useCallback(async (id) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    
    if (isSyncEnabled()) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('tool_history').delete().eq('id', id).eq('user_id', session.user.id);
      }
    }
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    if (isSyncEnabled()) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('tool_history').delete().eq('user_id', session.user.id);
      }
    }
  }, []);

  return (
    <HistoryContext.Provider value={{ history, addHistoryItem, deleteHistoryItem, clearHistory }}>
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
