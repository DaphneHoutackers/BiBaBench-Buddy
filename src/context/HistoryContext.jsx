import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const HistoryContext = createContext();

export function HistoryProvider({ children }) {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('labcalc_tool_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('labcalc_tool_history', JSON.stringify(history));
  }, [history]);

  const addHistoryItem = useCallback((item) => {
    setHistory(prev => {
      // Avoid exact duplicates back to back based on some fingerprint/data
      const isDuplicate = prev.length > 0 && 
        prev[0].toolId === item.toolId && 
        JSON.stringify(prev[0].data) === JSON.stringify(item.data);
      
      if (isDuplicate) return prev;

      const newItem = {
        ...item,
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
        timestamp: item.timestamp || Date.now(),
      };
      
      // Keep only last 50 history entries
      return [newItem, ...prev].slice(0, 50);
    });
  }, []);

  const deleteHistoryItem = useCallback((id) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
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
