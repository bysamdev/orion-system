import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase
    .from('tickets')
    .select('id, priority, created_at, sla_due_date, sla_status')
    .order('created_at', { ascending: false })
    .limit(5)
  console.log(data)
}

main()
