// Read-only Supabase client for queries
// When read replicas are enabled in Supabase, update SUPABASE_READ_URL with the replica URL
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// For now, use the same URL. When you enable read replicas in Supabase:
// 1. Go to Supabase Dashboard > Settings > Database
// 2. Enable Read Replicas (Pro plan required)
// 3. Copy the Read Replica connection string
// 4. Replace the URL below with the replica URL
const SUPABASE_READ_URL = "https://kcxwealimsfxqstoprdg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeHdlYWxpbXNmeHFzdG9wcmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDM4MDUsImV4cCI6MjA3NjI3OTgwNX0.AwpuHd329foLiEGY7OOllpALaw7KqHyReRciyr8tRM8";

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
  return SUPABASE_READ_URL !== "https://kcxwealimsfxqstoprdg.supabase.co";
};
