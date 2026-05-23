/**
 * Supabase Auth ユーザー一括作成スクリプト
 * 全メンバーのアカウントを作成し、st_members.user_id を更新する
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pbctrjnnrvssdyywgtdx.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk4MDYwOCwiZXhwIjoyMDg1NTU2NjA4fQ.NH1d5-y04Z-Peci7LXFyM0MQLly1JVx_7bsnG_j2i_I'
const INITIAL_PASSWORD = 'Coco2026!'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// メンバー一覧（増岡紗貴はメールアドレス不明のためスキップ）
const members = [
  { name: '早川 亜莉亜', email: 'namiyama1903@gmail.com',    memberId: '583faf35-b6f7-42fb-a2bb-e665c6e57ff3' },
  { name: '藤澤さくら',   email: 'sawafuji513@gmail.com',     memberId: '359974f1-bb0b-4d2a-a4e2-f38be42a5926' },
  { name: '米岡理子',     email: 'ringokko1230@gmail.com',    memberId: 'dd411654-a8cc-4bfb-a301-7eb08d05e13d' },
  { name: '吉田 碧',      email: 'greenpark122@gmail.com',    memberId: '02356d7d-1261-4d31-a1eb-151c1d74fe51' },
  { name: '下村優斗',     email: 'smmryut.9021@gmail.com',    memberId: '33e50909-bb9e-4128-adfe-f591a468b170' },
  { name: '相部大寿',     email: 'daijuaibe@gmail.com',       memberId: '061b5d03-c8e8-4f4b-b1ba-cf1e3afc0360' },
  { name: '堀川沙更',     email: 'sarasa.horikawa7@gmail.com', memberId: '829fdd82-8787-4e7d-b6b4-7bb203c8a582' },
  { name: '森口 愛子',    email: 'ar3x19@gmail.com',          memberId: '66246c77-a498-49dc-a13d-3d9d2d53146e' },
  { name: '田添莉奈',     email: 'r.tazoe0613@gmail.com',     memberId: 'ffcd275f-0d30-464f-8639-0d4ea771ed90' },
  { name: '久保 綾乃',    email: 'kuma.usa.ku.coro@gmail.com', memberId: 'bb1a5a16-7202-43aa-afa7-cc4ad63224af' },
  { name: '結城宙',       email: 'gogosorasora0911@gmail.com', memberId: 'd861d2d1-d4ef-48d3-a122-4205d32515f9' },
  { name: '黒沢綾香',     email: 'ayabonbon329@gmail.com',    memberId: 'bf219a57-11e1-43a2-bf5b-4e6123df8286' },
  { name: '山口 雄大',    email: 'arashi.y.0703@gmail.com',   memberId: '936f5790-d540-47ea-89f2-5373231e4518' },
  { name: '木村明里',     email: 'akari.kimura.17@gmail.com', memberId: 'dc7d61ce-f879-4bf8-8e98-23042db75419' },
  { name: '濵田真優',     email: 'skr.tmt.0915@gmail.com',    memberId: '6471b9cd-fb92-4e2e-bd92-af373e70669a' },
  { name: '原田陽一',     email: 'getty12234@gmail.com',      memberId: '31c5feee-d7f8-4b32-9656-85bdad02e318' },
  { name: '内田亜美',     email: 'shion.787878@gmail.com',    memberId: '2ef4aeb3-20a1-4756-8c34-b59e3022285d' },
]

async function createOrGetUser(email) {
  // まず既存ユーザーを確認
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw new Error('ユーザー一覧取得失敗: ' + listError.message)

  const existing = listData.users.find(u => u.email === email)
  if (existing) {
    return { user: existing, created: false }
  }

  // 新規作成
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: INITIAL_PASSWORD,
    email_confirm: true, // メール確認なしで有効化
  })

  if (error) throw new Error('ユーザー作成失敗: ' + error.message)
  return { user: data.user, created: true }
}

async function updateMemberUserId(memberId, userId) {
  const { error } = await supabase
    .from('st_members')
    .update({ user_id: userId })
    .eq('id', memberId)

  if (error) throw new Error('st_members更新失敗: ' + error.message)
}

async function main() {
  console.log('=== Supabase Auth ユーザー一括作成 ===')
  console.log(`対象: ${members.length}名`)
  console.log(`初期パスワード: ${INITIAL_PASSWORD}`)
  console.log('')

  const results = []

  for (const member of members) {
    process.stdout.write(`処理中: ${member.name} (${member.email}) ... `)

    try {
      // Auth ユーザー作成/取得
      const { user, created } = await createOrGetUser(member.email)

      // st_members.user_id を更新
      await updateMemberUserId(member.memberId, user.id)

      const status = created ? '✅ 新規作成' : '♻️ 既存'
      console.log(`${status} [auth_uid: ${user.id.substring(0, 8)}...]`)
      results.push({ name: member.name, email: member.email, status, authId: user.id })
    } catch (err) {
      console.log(`❌ エラー: ${err.message}`)
      results.push({ name: member.name, email: member.email, status: '❌ エラー', error: err.message })
    }

    // レート制限対策
    await new Promise(r => setTimeout(r, 300))
  }

  console.log('')
  console.log('=== 完了サマリー ===')
  const succeeded = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)
  console.log(`成功: ${succeeded.length}名 / 失敗: ${failed.length}名`)

  if (failed.length > 0) {
    console.log('\n失敗一覧:')
    failed.forEach(r => console.log(`  - ${r.name}: ${r.error}`))
  }

  console.log('\n=== ログイン情報 ===')
  console.log('URL: https://sales-tracker-next.vercel.app')
  console.log(`初期パスワード: ${INITIAL_PASSWORD}`)
  console.log('\n名前 | メール')
  results.filter(r => !r.error).forEach(r => {
    console.log(`${r.name} | ${r.email}`)
  })

  console.log('\n⚠️  増岡紗貴 はメールアドレス不明のためスキップ。別途確認が必要です。')
}

main().catch(console.error)
