import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const SUPABASE_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'tecnico@orionsystem.com',
    password: 'password123'
  });

  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  
  console.log("Logged in as:", authData.user.email);
  
  const { data: responses, error: respError } = await supabase.from('canned_responses').select('*').order('title');
  console.log("Responses Error:", respError);
  console.log("Responses Data:", responses);
}

check();
