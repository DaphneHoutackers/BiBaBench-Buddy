import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasValidConfig =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSyncEnabled = () => !!supabase;