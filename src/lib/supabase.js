import { createClient } from '@supabase/supabase-js';
import { DESKTOP_AUTH_CALLBACK_URL, parseDesktopAuthCallback } from './oauthRedirect';

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
        // Bypass browser Web Locks to prevent deadlocks in Electron/SPA reloads
        lock: async (name, acquireTimeout, fn) => {
          return await fn();
        },
      },
    })
  : null;

export const isSyncEnabled = () => !!supabase;

const isElectronApp = () =>
  typeof window !== 'undefined' && !!window.electronAPI?.openAuthUrl;

/**
 * Returns the current web origin for browser-based redirects such as password recovery.
 * Desktop OAuth uses its dedicated custom protocol in signInWithGithub instead.
 */
export const getAppUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:5173';
};

export const signInWithGithub = async () => {
  if (!supabase) throw new Error('Account synchronization is unavailable.');

  const desktop = isElectronApp();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: desktop ? DESKTOP_AUTH_CALLBACK_URL : `${getAppUrl()}/`,
      skipBrowserRedirect: desktop,
    },
  });

  if (error) throw error;

  if (desktop) {
    if (!data?.url) throw new Error('GitHub sign-in could not be started.');
    const opened = await window.electronAPI.openAuthUrl(data.url);
    if (!opened) throw new Error('GitHub sign-in could not be opened safely.');
  }

  return data;
};

export const completeDesktopOAuth = async (callbackUrl) => {
  if (!supabase) throw new Error('Account synchronization is unavailable.');

  const callback = parseDesktopAuthCallback(callbackUrl);
  const result = callback.type === 'code'
    ? await supabase.auth.exchangeCodeForSession(callback.code)
    : await supabase.auth.setSession({
        access_token: callback.accessToken,
        refresh_token: callback.refreshToken,
      });

  if (result.error) throw result.error;
  return result.data.session;
};
