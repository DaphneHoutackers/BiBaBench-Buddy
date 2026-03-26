import { Base44Client } from '@base44/sdk';

const db = new Base44Client({
    appId: import.meta.env.VITE_SUPABASE_URL,
    token: import.meta.env.VITE_SUPABASE_ANON_KEY,
    appBaseUrl: import.meta.env.VITE_SUPABASE_URL,
    functionsVersion: import.meta.env.VITE_SUPABASE_ANON_KEY
});

export const base44 = db;
export default db;

