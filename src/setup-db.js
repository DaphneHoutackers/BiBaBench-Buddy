import { InvokeLLM } from '@/api/gemini.js';
import { supabase } from '@/lib/supabase.js';

globalThis.__B44_DB__ = {
  auth: {
    isAuthenticated: async () => {
      if (!supabase) return false;
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    },
    me: async () => {
      if (!supabase) return null;
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user ?? null;
    },
    logout: async () => {
      if (supabase) await supabase.auth.signOut();
    }
  },
  entities: new Proxy({}, {
    get: () => ({
      filter: async () => [],
      get: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    })
  }),
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' }),
      InvokeLLM,
    }
  }
};
