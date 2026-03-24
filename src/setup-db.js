import { InvokeLLM } from '@/api/gemini.js';
import { supabase } from '@/lib/supabase.js';

globalThis.__APP_DB__ = {
  auth: {
    isAuthenticated: async () => {
      if (!supabase) return false;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return !!session;
    },
    me: async () => {
      if (!supabase) return null;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user ?? null;
    },
    logout: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
  },
  integrations: {
    Core: {
      InvokeLLM,
    },
  },
};