// 不要メンバー（結城宙・内田亜美・木村明里）を削除する
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('='))
    .map(([k, ...v]) => [k.trim(), v.join('=').trim()])
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const TO_DELETE = [
  { id: 'd861d2d1-d4ef-48d3-a122-4205d32515f9', name: '結城宙' },
  { id: '2ef4aeb3-20a1-4756-8c34-b59e3022285d', name: '内田亜美' },
  { id: 'dc7d61ce-f879-4bf8-8e98-23042db75419', name: '木村明里' },
]

for (const member of TO_DELETE) {
  // 関連データを順次削除（CASCADEがない場合の保険）
  await supabase.from('st_daily_metrics').delete().eq('member_id', member.id)
  await supabase.from('st_weekly_reviews').delete().eq('member_id', member.id)
  await supabase.from('st_daily_reports').delete().eq('member_id', member.id)
  await supabase.from('st_member_goals').delete().eq('member_id', member.id)
  await supabase.from('st_settings').delete().eq('member_id', member.id)
  // インスタアカウントは複数あり得る
  const { data: igAccounts } = await supabase.from('st_instagram_accounts').select('id').eq('member_id', member.id)
  if (igAccounts) {
    for (const acc of igAccounts) {
      await supabase.from('st_instagram_metrics').delete().eq('account_id', acc.id)
    }
    await supabase.from('st_instagram_accounts').delete().eq('member_id', member.id)
  }
  // 最後にメンバー本体を削除（削除結果を確認）
  const { data: deleted, error, count } = await supabase
    .from('st_members')
    .delete({ count: 'exact' })
    .eq('id', member.id)
    .select()
  if (error) {
    console.error(`❌ ${member.name} 削除失敗:`, error)
  } else {
    console.log(`${member.name}: count=${count}, deleted=${JSON.stringify(deleted)}`)
  }
}

// 削除後の確認
const { data: remaining } = await supabase
  .from('st_members')
  .select('name, team, is_admin')
  .eq('team', 'top')
  .order('name')

console.log('\n=== TOP チーム残存メンバー ===')
remaining?.forEach(m => console.log(`- ${m.name}${m.is_admin ? ' (admin)' : ''}`))
