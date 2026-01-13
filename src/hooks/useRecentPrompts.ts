import { useState, useCallback } from 'react';

const STORAGE_KEY = 'banana_recent_prompts';
const MAX_RECENT_PROMPTS = 5;

export function useRecentPrompts() {
  const [recentPrompts, setRecentPrompts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p): p is string => typeof p === 'string').slice(0, MAX_RECENT_PROMPTS);
    } catch (e) {
      console.warn('Failed to load recent prompts:', e);
      return [];
    }
  });

  const addRecentPrompt = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    
    setRecentPrompts(prev => {
      // Remove duplicates of the same content
      const filtered = prev.filter(p => p !== trimmed);
      // Add new prompt to the beginning
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_PROMPTS);
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent prompts:', e);
      }
      
      return updated;
    });
  }, []);

  const clearRecentPrompts = useCallback(() => {
    setRecentPrompts([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    recentPrompts,
    addRecentPrompt,
    clearRecentPrompts
  };
}
