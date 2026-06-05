// 3RDチームに末下さんを追加
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

const { data, error } = await supabase
  .from('st_members')
  .insert({ name: '末下', team: 'third', color: '#0ea5e9' })
  .select()
  .single()

if (error) {
  console.error('❌ 追加失敗:', error)
  process.exit(1)
}
console.log('✅ 末下さん追加完了:', data)
console.log('\n⚠️ Auth招待は別途必要：')
console.log('   Supabase Dashboard > Authentication > Users > Add user > srnhy6104@icloud.com を招待')
console.log('   招待後、auth.users の id を st_members.user_id にセットする必要あり')
