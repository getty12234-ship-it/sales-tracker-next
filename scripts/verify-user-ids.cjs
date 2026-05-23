/**
 * st_members.user_id の紐付けを確認
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pbctrjnnrvssdyywgtdx.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk4MDYwOCwiZXhwIjoyMDg1NTU2NjA4fQ.NH1d5-y04Z-Peci7LXFyM0MQLly1JVx_7bsnG_j2i_I'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  const { data, error } = await supabase
    .from('st_members')
    .select('id, name, user_id')
    .order('name')

  if (error) { console.error(error); return; }

  console.log('名前 | member_id | user_id')
  data.forEach(m => {
    const linked = m.user_id ? '✅' : '❌'
    console.log(`${linked} ${m.name} | ${m.id.substring(0,8)}... | ${m.user_id ? m.user_id.substring(0,8)+'...' : 'NULL'}`)
  })
}

main().catch(console.error)
