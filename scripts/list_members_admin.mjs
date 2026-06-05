// メンバー一覧を取得して、削除対象と原田の状態を確認する
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
  .select('id, name, team, is_admin, user_id, created_at')
  .order('created_at')

if (error) { console.error(error); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
