/**
 * 全メンバーのパスワードを Coco2026! にリセットするスクリプト
 * 既存ユーザーも含めて強制リセット
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pbctrjnnrvssdyywgtdx.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk4MDYwOCwiZXhwIjoyMDg1NTU2NjA4fQ.NH1d5-y04Z-Peci7LXFyM0MQLly1JVx_7bsnG_j2i_I'
const NEW_PASSWORD = 'Coco2026!'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// 対象メンバー（全員）
const members = [
  { name: '早川 亜莉亜', email: 'namiyama1903@gmail.com' },
  { name: '藤澤さくら',   email: 'sawafuji513@gmail.com' },
  { name: '米岡理子',     email: 'ringokko1230@gmail.com' },
  { name: '吉田 碧',      email: 'greenpark122@gmail.com' },
  { name: '下村優斗',     email: 'smmryut.9021@gmail.com' },
  { name: '相部大寿',     email: 'daijuaibe@gmail.com' },
  { name: '堀川沙更',     email: 'sarasa.horikawa7@gmail.com' },
  { name: '森口 愛子',    email: 'ar3x19@gmail.com' },
  { name: '田添莉奈',     email: 'r.tazoe0613@gmail.com' },
  { name: '久保 綾乃',    email: 'kuma.usa.ku.coro@gmail.com' },
  { name: '黒沢綾香',     email: 'ayabonbon329@gmail.com' },
  { name: '山口 雄大',    email: 'arashi.y.0703@gmail.com' },
  { name: '木村明里',     email: 'akari.kimura.17@gmail.com' },
  { name: '濵田真優',     email: 'skr.tmt.0915@gmail.com' },
  { name: '土江早貴',     email: 'happiness4361@gmail.com' },
  { name: '原田陽一',     email: 'getty12234@gmail.com' },
  // 結城宙・内田亜美 は後回し（DM未送信のため）
  // { name: '結城宙',       email: 'gogosorasora0911@gmail.com' },
  // { name: '内田亜美',     email: 'shion.787878@gmail.com' },
]

async function main() {
  console.log('=== パスワード一括リセット ===')
  console.log(`新パスワード: ${NEW_PASSWORD}`)
  console.log(`対象: ${members.length}名\n`)

  // Auth ユーザー一覧を取得
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error('ユーザー一覧取得失敗:', listError.message)
    process.exit(1)
  }

  const authUsers = listData.users
  console.log(`Supabase Auth に登録済み: ${authUsers.length}名\n`)

  const results = []

  for (const member of members) {
    process.stdout.write(`処理中: ${member.name} (${member.email}) ... `)

    // メールアドレスで auth ユーザーを検索
    const authUser = authUsers.find(u => u.email === member.email)

    if (!authUser) {
      console.log('⚠️  Auth ユーザーが存在しない → 新規作成します')
      // 新規作成
      const { data, error } = await supabase.auth.admin.createUser({
        email: member.email,
        password: NEW_PASSWORD,
        email_confirm: true,
      })
      if (error) {
        console.log(`❌ 作成失敗: ${error.message}`)
        results.push({ ...member, status: '❌ 作成失敗', error: error.message })
      } else {
        console.log(`✅ 新規作成`)
        results.push({ ...member, status: '✅ 新規作成', authId: data.user.id })
      }
    } else {
      // パスワードリセット
      const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: NEW_PASSWORD,
      })
      if (error) {
        console.log(`❌ リセット失敗: ${error.message}`)
        results.push({ ...member, status: '❌ リセット失敗', error: error.message })
      } else {
        console.log(`✅ パスワードリセット完了`)
        results.push({ ...member, status: '✅ リセット完了', authId: authUser.id })
      }
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n=== 完了サマリー ===')
  const ok = results.filter(r => !r.error)
  const ng = results.filter(r => r.error)
  console.log(`成功: ${ok.length}名 / 失敗: ${ng.length}名`)

  if (ng.length > 0) {
    console.log('\n失敗一覧:')
    ng.forEach(r => console.log(`  ❌ ${r.name}: ${r.error}`))
  }

  console.log('\n=== ログイン情報（全員共通） ===')
  console.log('URL: https://sales-tracker-next.vercel.app/login')
  console.log(`パスワード: ${NEW_PASSWORD}`)
  console.log('\n成功したメンバー:')
  ok.forEach(r => console.log(`  ✅ ${r.name}: ${r.email}`))
}

main().catch(console.error)
