/**
 * This module MUST be imported before anything else.
 * It sets up globalThis.__B44_DB__ with the real Gemini AI integration
 * so that all components using `globalThis.__B44_DB__` pick up the real implementation.
 */
import { InvokeLLM } from '@/api/gemini.js';

globalThis.__B44_DB__ = {
  auth: {
    isAuthenticated: async () => true,
    me: async () => ({ name: 'Local User' }),
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
