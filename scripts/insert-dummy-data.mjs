// ダミーデータ挿入スクリプト（一人分）
// 実行: node scripts/insert-dummy-data.mjs

const SUPABASE_URL = 'https://pbctrjnnrvssdyywgtdx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODA2MDgsImV4cCI6MjA4NTU1NjYwOH0.MTOIZ9enImEiakaxyNb-SGw6QFeYFia83cmOk5TSnq4'

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
  return res.json()
}

async function upsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function main() {
  // メンバー一覧取得
  const members = await get('st_members?select=id,name,team&order=created_at')
  console.log('メンバー一覧:')
  members.forEach((m, i) => console.log(`  ${i}: ${m.name} (${m.team || 'top'}) id=${m.id}`))

  // 早川 亜莉亜 を対象に
  const target = members.find(m => m.name.includes('早川')) || members[1]
  console.log(`\nダミーデータ挿入対象: ${target.name} (${target.id})`)

  // 予算設定
  const budgets = {
    seiyaku: 3,
    mendan_exec: 12,
    doin_exec: 15,
    apo_exec: 30,
    offer: 20,
    apo_get: 50,
    post: 60,
    line_exchange: 100,
    doin_get: 20,
  }
  // 目標 = 予算 × 1.2（切り上げ）& b_ prefix で格納
  const goalsWithBudgets = {}
  for (const [k, v] of Object.entries(budgets)) {
    goalsWithBudgets[k] = Math.ceil(v * 1.2)
    goalsWithBudgets[`b_${k}`] = v
  }

  // 設定保存（upsert）
  const settingsRes = await upsert('st_settings', { member_id: target.id, goals: goalsWithBudgets })
  if (Array.isArray(settingsRes)) {
    console.log('\n✅ 設定保存成功:', JSON.stringify(settingsRes[0]?.goals).substring(0, 100))
  } else {
    console.log('\n設定レスポンス:', JSON.stringify(settingsRes).substring(0, 200))
  }

  // 日次データ挿入（2026年5月、1〜22日）
  const YM = '2026-05'
  const today = 22

  const metricsToInsert = []
  for (let d = 1; d <= today; d++) {
    const dateStr = `${YM}-${String(d).padStart(2, '0')}`
    const isWeekend = [0, 6].includes(new Date(dateStr).getDay())

    if (isWeekend) {
      metricsToInsert.push({
        member_id: target.id, date: dateStr,
        post: 2, line_exchange: 1,
        apo_get: 0, apo_exec: 0, apo_cxl: 0,
        test_close: 0, offer: 0, ng: 0, muchaku: 0,
        doin_get: 0, doin_get_cxl: 0, doin_exec: 0, doin_exec_cxl: 0,
        mendan_get: 0, mendan_exec: 0, seiyaku: 0, cooling_off: 0,
      })
    } else {
      // 平日：現実的なバラつきのあるデータ
      const rand = () => Math.random()
      const apoGet = Math.round(rand() * 3 + 1)      // 1〜4
      const apoExec = Math.min(apoGet, Math.round(rand() * 2 + 1)) // 1〜3
      const offer = Math.round(rand() * 1.2)
      const doinGet = Math.round(rand() * 1.5)
      const doinExec = doinGet > 0 ? (rand() > 0.3 ? doinGet : 0) : 0
      const seiyaku = doinExec > 0 ? (rand() > 0.55 ? 1 : 0) : 0
      const mendan = Math.round(rand() * 0.7)

      metricsToInsert.push({
        member_id: target.id, date: dateStr,
        post: Math.round(rand() * 2 + 2),
        line_exchange: Math.round(rand() * 4 + 3),
        apo_get: apoGet,
        apo_exec: apoExec,
        apo_cxl: rand() > 0.85 ? 1 : 0,
        test_close: Math.round(rand() * 0.4),
        offer,
        ng: Math.round(rand() * 0.7),
        muchaku: Math.round(rand() * 0.4),
        doin_get: doinGet,
        doin_get_cxl: 0,
        doin_exec: doinExec,
        doin_exec_cxl: 0,
        mendan_get: mendan,
        mendan_exec: mendan,
        seiyaku,
        cooling_off: 0,
      })
    }
  }

  // upsert 一括
  const metricsRes = await upsert('st_daily_metrics', metricsToInsert)
  if (Array.isArray(metricsRes)) {
    console.log(`\n✅ 日次データ挿入: ${metricsRes.length}件`)
  } else {
    console.log('\n日次データエラー:', JSON.stringify(metricsRes).substring(0, 300))
  }

  // 合計確認
  const inserted = await get(`st_daily_metrics?member_id=eq.${target.id}&date=gte.${YM}-01&date=lte.${YM}-22&select=seiyaku,apo_exec,doin_exec,apo_get,mendan_exec,offer,post,line_exchange,doin_get`)
  if (Array.isArray(inserted)) {
    const T = (k) => inserted.reduce((s, r) => s + (r[k] || 0), 0)
    console.log('\n📊 月次合計（ダミー）:')
    console.log(`  成約:       ${T('seiyaku')}  （予算3, 目標4）`)
    console.log(`  面談実施:   ${T('mendan_exec')}  （予算12, 目標15）`)
    console.log(`  動員実施:   ${T('doin_exec')}  （予算15, 目標18）`)
    console.log(`  アポ実施:   ${T('apo_exec')}  （予算30, 目標36）`)
    console.log(`  オファー:   ${T('offer')}  （予算20, 目標24）`)
    console.log(`  アポ獲得:   ${T('apo_get')}  （予算50, 目標60）`)
    console.log(`  SNS投稿:    ${T('post')}  （予算60, 目標72）`)
    console.log(`  LINE交換:   ${T('line_exchange')}  （予算100, 目標120）`)
    console.log(`  動員獲得:   ${T('doin_get')}  （予算20, 目標24）`)
  }

  console.log(`\n✅ 完了！ブラウザで「早川 亜莉亜」を選択してサマリーを確認してください。`)
}

main().catch(console.error)
