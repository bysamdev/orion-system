// Read-only Supabase client for queries
// When read replicas are enabled in Supabase, update SUPABASE_READ_URL with the replica URL
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// For now, use the same URL. When you enable read replicas in Supabase:
// 1. Go to Supabase Dashboard > Settings > Database
// 2. Enable Read Replicas (Pro plan required)
// 3. Copy the Read Replica connection string
// 4. Replace the URL below with the replica URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_READ_URL = (import.meta.env.VITE_SUPABASE_READ_URL as string | undefined) || SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_READ_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Variáveis de ambiente do Supabase ausentes. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env'
  );
}

export const supabaseRead = createClient<Database>(SUPABASE_READ_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-read-replica',
    },
  },
});

// Helper function to check if read replicas are configured
export const isReadReplicaConfigured = () => {
  return Boolean(import.meta.env.VITE_SUPABASE_READ_URL);
};
