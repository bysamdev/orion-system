import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kcxwealimsfxqstoprdg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeHdlYWxpbXNmeHFzdG9wcmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDM4MDUsImV4cCI6MjA3NjI3OTgwNX0.AwpuHd329foLiEGY7OOllpALaw7KqHyReRciyr8tRM8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("=== FASE 1: SAÚDE DO BANCO ===");

  // Autenticar como Admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'samterres42@gmail.com',
    password: '!oivelox2004'
  });

  if (authError) {
    console.error("Erro ao autenticar:", authError.message);
    return;
  }
  console.log(`Autenticado como: ${authData.user.email}`);

  // 1. Integridade dos tickets
  const { data: tickets, error: ticketsError } = await supabase.from('tickets').select('status');
  if (ticketsError) {
    console.error("Erro ao buscar tickets:", ticketsError);
  } else {
    const statusCount = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});
    console.log("\n1. Integridade dos tickets (Agrupamento por status):");
    console.log(statusCount);
    console.log(`Total de tickets: ${tickets.length}`);
  }

  // 2. Tickets sem empresa vinculada
  const { data: noCompany, error: noCompanyError } = await supabase.from('tickets').select('id, ticket_number').is('company_id', null);
  if (noCompanyError) {
    console.error("Erro ao buscar tickets sem empresa:", noCompanyError);
  } else {
    console.log("\n2. Tickets sem empresa vinculada:");
    console.log(`Encontrados: ${noCompany.length}`);
    if (noCompany.length > 0) console.log(noCompany);
  }

  // 3. Tickets sem criador válido
  // (Cannot query auth.users directly with anon key, checking if user_id is null or if there are user_id without profiles)
  const { data: noCreator, error: noCreatorError } = await supabase.from('tickets').select('id, ticket_number, user_id').is('user_id', null);
  if (noCreatorError) {
    console.error("Erro ao buscar tickets sem criador:", noCreatorError);
  } else {
    console.log("\n3. Tickets com user_id = null:");
    console.log(`Encontrados: ${noCreator.length}`);
  }

  // 4. Timers travados há mais de 24h
  const { data: activeTimers, error: activeTimersError } = await supabase.from('time_entries').select('id, ticket_id, start_time').is('end_time', null);
  if (activeTimersError) {
    console.error("Erro ao buscar timers:", activeTimersError);
  } else {
    console.log("\n4. Timers travados há mais de 24h:");
    const now = new Date();
    const lockedTimers = activeTimers.filter(t => {
      const started = new Date(t.start_time);
      const diffMs = now - started;
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours > 24;
    });
    console.log(`Encontrados: ${lockedTimers.length}`);
    lockedTimers.forEach(t => console.log(`Timer no ticket ${t.ticket_id} travado desde ${t.start_time}`));
  }
}

runAudit();
