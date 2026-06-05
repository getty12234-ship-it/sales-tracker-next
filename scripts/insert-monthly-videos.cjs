/**
 * 日報用 月別動画スケジュール一括登録スクリプト
 * 曜日テーマ: 月=マインド 火=アポ獲得 水=テスクロ 木=ラポール 金=面談・成約
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pbctrjnnrvssdyywgtdx.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk4MDYwOCwiZXhwIjoyMDg1NTU2NjA4fQ.NH1d5-y04Z-Peci7LXFyM0MQLly1JVx_7bsnG_j2i_I'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const videos = [
  // ===== 5月残り（5/26〜） =====
  // 月: マインドセット
  { date: '2026-05-26', url: 'https://www.youtube.com/watch?v=6dEtGI8NSH8', memo: '【甘さを捨てろ】営業を制する最強マインドセット' },
  // 火: アポ獲得・DM
  { date: '2026-05-27', url: 'https://www.youtube.com/watch?v=H7fjKcJ6CnA', memo: 'インスタDMだけで新規顧客を獲得する方法' },
  // 水: テスクロ・オファー
  { date: '2026-05-28', url: 'https://www.youtube.com/watch?v=M4RO5I1Uor0', memo: '【完全解説】売れる営業のクロージング術' },
  // 木: ラポール・信頼構築
  { date: '2026-05-29', url: 'https://www.youtube.com/watch?v=M3YcN0YIkU4', memo: 'ラポールを構築テクニック たった一言で信頼関係を築く術' },
  // 金: 面談・成約・振り返り
  { date: '2026-05-30', url: 'https://www.youtube.com/watch?v=nKzNXbwuMMg', memo: '商談の進め方で成約率が変わる！最後のひと押しテクニック' },

  // ===== 6月 =====
  // 週1: 6/2〜6/6
  { date: '2026-06-02', url: 'https://www.youtube.com/watch?v=-kdrwwFQWYw', memo: '売上を安定させる営業マインドセットの作り方' },
  { date: '2026-06-03', url: 'https://www.youtube.com/watch?v=015NkD-Kb3E', memo: '世界No1の営業から学ぶ営業テクニック9選' },
  { date: '2026-06-04', url: 'https://www.youtube.com/watch?v=aOPLkFvo_Io', memo: 'クロージングが苦手な人へ｜自然に決める話し方３選' },
  { date: '2026-06-05', url: 'https://www.youtube.com/watch?v=j_UFGOPmLJc', memo: 'すぐに使えるラポール（信頼関係）を築く方法' },
  { date: '2026-06-06', url: 'https://www.youtube.com/watch?v=CdmCZtf4BMY', memo: 'トップ営業の「クロージングトーク」元リクルート全国1位' },

  // 週2: 6/9〜6/13
  { date: '2026-06-09', url: 'https://www.youtube.com/watch?v=ieUptV5chh4', memo: '営業苦手な人が売れるようになるマインドセット' },
  { date: '2026-06-10', url: 'https://www.youtube.com/watch?v=_sZvkdft44Y', memo: '【営業の9割が知らない】新規営業を成功に導く「最強の武器」' },
  { date: '2026-06-11', url: 'https://www.youtube.com/watch?v=HLT0ECYsXrA', memo: '営業に必要なのは"押し"じゃなく"後押し"だった' },
  { date: '2026-06-12', url: 'https://www.youtube.com/watch?v=P5E2L0FFzVs', memo: 'お客様からの信頼度アップ！ラポール形成の必勝テクニック' },
  { date: '2026-06-13', url: 'https://www.youtube.com/watch?v=2hn4NgeO-qw', memo: 'まだPDCAやってる？営業に不可欠な「OODAループ」とは？' },

  // 週3: 6/16〜6/20
  { date: '2026-06-16', url: 'https://www.youtube.com/watch?v=cy9y4sAHRFY', memo: '【裏技】営業でモチベーション・やる気を最高に上げる方法' },
  { date: '2026-06-17', url: 'https://www.youtube.com/watch?v=D_N9ZKMJBEI', memo: 'インスタDMで相互コミュニケーションを加速させよう' },
  { date: '2026-06-18', url: 'https://www.youtube.com/watch?v=FoZ-490jTRI', memo: '【損したくない人必見】クロージングで失敗しない7つの営業トーク集' },
  { date: '2026-06-19', url: 'https://www.youtube.com/watch?v=5uylkb4bwFM', memo: '【ラポール形成】共感を使ってお客様の心を開くテクニック' },
  { date: '2026-06-20', url: 'https://www.youtube.com/watch?v=m_oVEGzlVbk', memo: 'PDCAで経営改善｜実践編-営業活動' },

  // 週4: 6/23〜6/27
  { date: '2026-06-23', url: 'https://www.youtube.com/watch?v=W0bX_fv5Xg0', memo: '【聞き流せばOK】この動画1本で分かる！営業完全マニュアル' },
  { date: '2026-06-24', url: 'https://www.youtube.com/watch?v=H7fjKcJ6CnA', memo: 'インスタDMだけで新規顧客を獲得する方法（復習）' },
  { date: '2026-06-25', url: 'https://www.youtube.com/watch?v=e_5dM0Ai-Sc', memo: '【クロージングの極意】テストクロージングで商談のグダグダ解消' },
  { date: '2026-06-26', url: 'https://www.youtube.com/watch?v=auppeUC7RoQ', memo: 'ラポール（信頼関係）を作る最重要スキル ペーシングとは？' },
  { date: '2026-06-27', url: 'https://www.youtube.com/watch?v=pCfj25jIGD4', memo: '【営業】クロージングの流れを具体的に解説【演技あり】' },

  // 週5: 6/30（月のみ）
  { date: '2026-06-30', url: 'https://www.youtube.com/watch?v=6dEtGI8NSH8', memo: '【甘さを捨てろ】営業を制する最強マインドセット（月次締め）' },
]

async function main() {
  console.log(`=== 日報用動画スケジュール登録 ===`)
  console.log(`対象: ${videos.length}件\n`)

  let ok = 0, ng = 0
  for (const v of videos) {
    const { error } = await supabase
      .from('st_monthly_videos')
      .upsert({ date: v.date, video_url: v.url }, { onConflict: 'date' })

    if (error) {
      console.log(`❌ ${v.date}: ${error.message}`)
      ng++
    } else {
      console.log(`✅ ${v.date} (${getDayName(v.date)}) ${v.memo}`)
      ok++
    }
  }

  console.log(`\n=== 完了: 成功 ${ok}件 / 失敗 ${ng}件 ===`)
}

function getDayName(dateStr) {
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return days[new Date(dateStr).getDay()]
}

main().catch(console.error)
