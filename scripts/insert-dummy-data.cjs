// ダミーデータ挿入スクリプト（一人分）
// 実行: node scripts/insert-dummy-data.cjs

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://pbctrjnnrvssdyywgtdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5ODA2MDgsImV4cCI6MjA4NTU1NjYwOH0.MTOIZ9enImEiakaxyNb-SGw6QFeYFia83cmOk5TSnq4'
)

async function main() {
  // メンバー一覧
  const { data: members } = await supabase.from('st_members').select('id,name,team').order('created_at')
  const target = members.find(m => m.name.includes('早川')) || members[1]
  console.log(`ダミー対象: ${target.name} (${target.id})`)

  // 予算設定
  const budgets = {
    seiyaku: 3, mendan_exec: 12, doin_exec: 15, apo_exec: 30,
    offer: 20, apo_get: 50, post: 60, line_exchange: 100, doin_get: 20,
  }
  const goalsWithBudgets = {}
  for (const [k, v] of Object.entries(budgets)) {
    goalsWithBudgets[k] = Math.ceil(v * 1.2)
    goalsWithBudgets[`b_${k}`] = v
  }

  const { error: settingsErr } = await supabase
    .from('st_settings')
    .upsert({ member_id: target.id, goals: goalsWithBudgets }, { onConflict: 'member_id' })
  if (settingsErr) console.error('設定エラー:', settingsErr.message)
  else console.log('✅ 設定保存完了（予算・目標）')

  // 日次データ挿入（2026年5月1〜22日）
  const YM = '2026-05'
  const metricsToInsert = []

  for (let d = 1; d <= 22; d++) {
    const dateStr = `${YM}-${String(d).padStart(2, '0')}`
    const isWeekend = [0, 6].includes(new Date(dateStr).getDay())
    const rand = () => Math.random()

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
      const apoGet = Math.round(rand() * 3 + 2)
      const apoExec = Math.min(apoGet, Math.round(rand() * 2 + 1))
      const offer = Math.round(rand() * 1.5)
      const doinGet = Math.round(rand() * 1.5)
      const doinExec = doinGet > 0 ? (rand() > 0.3 ? doinGet : 0) : 0
      const seiyaku = doinExec > 0 ? (rand() > 0.5 ? 1 : 0) : 0
      const mendan = Math.round(rand() * 0.8)

      metricsToInsert.push({
        member_id: target.id, date: dateStr,
        post: Math.round(rand() * 2 + 2),
        line_exchange: Math.round(rand() * 5 + 3),
        apo_get: apoGet,
        apo_exec: apoExec,
        apo_cxl: rand() > 0.85 ? 1 : 0,
        test_close: Math.round(rand() * 0.4),
        offer,
        ng: Math.round(rand() * 0.8),
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

  const { error: metricsErr } = await supabase
    .from('st_daily_metrics')
    .upsert(metricsToInsert, { onConflict: 'member_id,date' })
  if (metricsErr) console.error('日次データエラー:', metricsErr.message)
  else console.log(`✅ 日次データ挿入完了: ${metricsToInsert.length}件`)

  // 合計確認
  const { data: rows } = await supabase
    .from('st_daily_metrics')
    .select('seiyaku,mendan_exec,doin_exec,apo_exec,offer,apo_get,post,line_exchange,doin_get')
    .eq('member_id', target.id)
    .gte('date', `${YM}-01`)
    .lte('date', `${YM}-22`)

  if (rows) {
    const T = k => rows.reduce((s, r) => s + (r[k] || 0), 0)
    console.log('\n📊 月次合計（ダミー）:')
    console.log(`  成約:       ${T('seiyaku')}  （予算3 / 目標4）`)
    console.log(`  面談実施:   ${T('mendan_exec')}  （予算12 / 目標15）`)
    console.log(`  動員実施:   ${T('doin_exec')}  （予算15 / 目標18）`)
    console.log(`  アポ実施:   ${T('apo_exec')}  （予算30 / 目標36）`)
    console.log(`  オファー:   ${T('offer')}  （予算20 / 目標24）`)
    console.log(`  アポ獲得:   ${T('apo_get')}  （予算50 / 目標60）`)
    console.log(`  SNS投稿:    ${T('post')}  （予算60 / 目標72）`)
    console.log(`  LINE交換:   ${T('line_exchange')}  （予算100 / 目標120）`)
    console.log(`  動員獲得:   ${T('doin_get')}  （予算20 / 目標24）`)
    console.log(`\n✅ ブラウザで「${target.name}」を選択してサマリー画面を確認してください。`)
  }
}

main().catch(console.error)
