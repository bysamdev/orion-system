import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data, error } = await supabase.from('tickets').select('id, title, status, created_at, ticket_number').order('created_at', { ascending: false }).limit(5);
  console.log('Error:', error);
  console.log('Tickets:', data);
})();
