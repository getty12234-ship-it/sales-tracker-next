/**
 * 早川 亜莉亜・久保 綾乃 をコアチームに移動するスクリプト
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pbctrjnnrvssdyywgtdx.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk4MDYwOCwiZXhwIjoyMDg1NTU2NjA4fQ.NH1d5-y04Z-Peci7LXFyM0MQLly1JVx_7bsnG_j2i_I'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const CORE_MEMBERS = [
  { name: '早川 亜莉亜', id: '583faf35-b6f7-42fb-a2bb-e665c6e57ff3' },
  { name: '久保 綾乃',   id: 'bb1a5a16-7202-43aa-afa7-cc4ad63224af' },
]

async function main() {
  console.log('=== コアチームへの移動 ===')

  for (const m of CORE_MEMBERS) {
    process.stdout.write(`${m.name} ... `)
    const { error } = await supabase
      .from('st_members')
      .update({ team: 'core' })
      .eq('id', m.id)

    if (error) {
      console.log(`❌ 失敗: ${error.message}`)
    } else {
      console.log('✅ core に変更完了')
    }
  }

  // 確認
  const { data } = await supabase
    .from('st_members')
    .select('name, team')
    .in('id', CORE_MEMBERS.map(m => m.id))

  console.log('\n=== 確認 ===')
  data?.forEach(m => console.log(`  ${m.name}: ${m.team}`))
}

main().catch(console.error)
