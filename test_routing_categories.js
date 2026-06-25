import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "cliente@orionsystem.com",
    password: "password123"
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  const categories = ['software', 'rede', 'email', 'erp', 'outros'];
  const createdIds = [];

  for (const cat of categories) {
    console.log(`Creating ticket for category: ${cat}`);
    const { data, error } = await supabase.from('tickets').insert({
      title: `Test Routing Rule for ${cat}`,
      description: 'Testing auto-assignment',
      category: cat,
      priority: 'alta',
      company_id: '61cb93f4-8e93-48f3-860d-c40f510ac55e',
      created_by: auth.user.id
    }).select('id');
    
    if (error) {
      console.error(error);
    } else {
      createdIds.push(data[0].id);
    }
  }

  console.log("\nVerifying assignments...");
  const { data: verifyData } = await supabase.from('tickets').select('id, category, assigned_to_user_id').in('id', createdIds);
  
  if (verifyData) {
    verifyData.forEach(ticket => {
      console.log(`Ticket ID ${ticket.id.substring(0,8)} | Category: ${ticket.category} | Assigned To: ${ticket.assigned_to_user_id}`);
    });
  }
}

run();
