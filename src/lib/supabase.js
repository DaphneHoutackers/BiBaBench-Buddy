import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasValidConfig =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'bibabenchbuddy-auth',
        autoRefreshToken: true,
      },
    })
  : null;

export const isSyncEnabled = () => !!supabase;

/**
 * Returns the correct redirect URL for OAuth flows.
 * Works in both web (uses window.location.origin) and Electron (uses the app URL).
 */
export const getAppUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:5173';
};