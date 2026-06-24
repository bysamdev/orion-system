import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const SUPABASE_KEY = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1] || env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const p = await supabase.from('profiles').select('id, email, company_id, role');
  console.log("PROFILES ERROR:", p.error);
  console.log("PROFILES DATA:", p.data);

  const r = await supabase.from('canned_responses').select('id, title, company_id');
  console.log("RESPONSES ERROR:", r.error);
  console.log("RESPONSES DATA:", r.data);
}

check();
