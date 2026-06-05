/**
 * 動画スケジュール修正スクリプト
 * 曜日テーマ: 月=マインド 火=アポ獲得 水=テスクロ 木=ラポール 金=成約・振り返り
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pbctrjnnrvssdyywgtdx.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiY3Ryam5ucnZzc2R5eXdndGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk4MDYwOCwiZXhwIjoyMDg1NTU2NjA4fQ.NH1d5-y04Z-Peci7LXFyM0MQLly1JVx_7bsnG_j2i_I'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// 正しいスケジュール（曜日テーマ通り・土日除外）
const videos = [
  // ===== 5月残り =====
  // 5/26(火) アポ獲得
  { date: '2026-05-26', url: 'https://www.youtube.com/watch?v=H7fjKcJ6CnA',   memo: '🔥火｜インスタDMだけで新規顧客を獲得する方法' },
  // 5/27(水) テスクロ
  { date: '2026-05-27', url: 'https://www.youtube.com/watch?v=M4RO5I1Uor0',   memo: '💡水｜【完全解説】売れる営業のクロージング術' },
  // 5/28(木) ラポール
  { date: '2026-05-28', url: 'https://www.youtube.com/watch?v=M3YcN0YIkU4',   memo: '🤝木｜ラポールを構築テクニック たった一言で信頼関係を築く術' },
  // 5/29(金) 成約・振り返り
  { date: '2026-05-29', url: 'https://www.youtube.com/watch?v=nKzNXbwuMMg',   memo: '🏆金｜商談の進め方で成約率が変わる！最後のひと押しテクニック' },

  // ===== 6月 Week1 (6/1〜6/5) =====
  { date: '2026-06-01', url: 'https://www.youtube.com/watch?v=6dEtGI8NSH8',   memo: '🔥月｜【甘さを捨てろ】営業を制する最強マインドセット' },
  { date: '2026-06-02', url: 'https://www.youtube.com/watch?v=015NkD-Kb3E',   memo: '🎯火｜世界No1の営業から学ぶ営業テクニック9選' },
  { date: '2026-06-03', url: 'https://www.youtube.com/watch?v=aOPLkFvo_Io',   memo: '💡水｜クロージングが苦手な人へ｜自然に決める話し方３選' },
  { date: '2026-06-04', url: 'https://www.youtube.com/watch?v=j_UFGOPmLJc',   memo: '🤝木｜すぐに使えるラポール（信頼関係）を築く方法' },
  { date: '2026-06-05', url: 'https://www.youtube.com/watch?v=CdmCZtf4BMY',   memo: '🏆金｜トップ営業の「クロージングトーク」元リクルート全国1位' },

  // ===== 6月 Week2 (6/8〜6/12) =====
  { date: '2026-06-08', url: 'https://www.youtube.com/watch?v=-kdrwwFQWYw',   memo: '🔥月｜売上を安定させる営業マインドセットの作り方' },
  { date: '2026-06-09', url: 'https://www.youtube.com/watch?v=_sZvkdft44Y',   memo: '🎯火｜【営業の9割が知らない】新規営業を成功に導く「最強の武器」' },
  { date: '2026-06-10', url: 'https://www.youtube.com/watch?v=HLT0ECYsXrA',   memo: '💡水｜営業に必要なのは"押し"じゃなく"後押し"だった' },
  { date: '2026-06-11', url: 'https://www.youtube.com/watch?v=P5E2L0FFzVs',   memo: '🤝木｜お客様からの信頼度アップ！ラポール形成の必勝テクニック' },
  { date: '2026-06-12', url: 'https://www.youtube.com/watch?v=2hn4NgeO-qw',   memo: '🏆金｜まだPDCAやってる？営業に不可欠な「OODAループ」とは？' },

  // ===== 6月 Week3 (6/15〜6/19) =====
  { date: '2026-06-15', url: 'https://www.youtube.com/watch?v=ieUptV5chh4',   memo: '🔥月｜営業苦手な人が売れるようになるマインドセット' },
  { date: '2026-06-16', url: 'https://www.youtube.com/watch?v=D_N9ZKMJBEI',   memo: '🎯火｜インスタDMで相互コミュニケーションを加速させよう' },
  { date: '2026-06-17', url: 'https://www.youtube.com/watch?v=FoZ-490jTRI',   memo: '💡水｜【損したくない人必見】クロージングで失敗しない7つの営業トーク集' },
  { date: '2026-06-18', url: 'https://www.youtube.com/watch?v=5uylkb4bwFM',   memo: '🤝木｜【ラポール形成】共感を使ってお客様の心を開くテクニック' },
  { date: '2026-06-19', url: 'https://www.youtube.com/watch?v=m_oVEGzlVbk',   memo: '🏆金｜PDCAで経営改善｜実践編-営業活動' },

  // ===== 6月 Week4 (6/22〜6/26) =====
  { date: '2026-06-22', url: 'https://www.youtube.com/watch?v=cy9y4sAHRFY',   memo: '🔥月｜【裏技】営業でモチベーション・やる気を最高に上げる方法' },
  { date: '2026-06-23', url: 'https://www.youtube.com/watch?v=H7fjKcJ6CnA',   memo: '🎯火｜インスタDMだけで新規顧客を獲得する方法（復習）' },
  { date: '2026-06-24', url: 'https://www.youtube.com/watch?v=e_5dM0Ai-Sc',   memo: '💡水｜【クロージングの極意】テストクロージングで商談のグダグダ解消' },
  { date: '2026-06-25', url: 'https://www.youtube.com/watch?v=auppeUC7RoQ',   memo: '🤝木｜ラポール（信頼関係）を作る最重要スキル ペーシングとは？' },
  { date: '2026-06-26', url: 'https://www.youtube.com/watch?v=pCfj25jIGD4',   memo: '🏆金｜【営業】クロージングの流れを具体的に解説【演技あり】' },

  // ===== 6月 Week5 (6/29〜6/30) =====
  { date: '2026-06-29', url: 'https://www.youtube.com/watch?v=W0bX_fv5Xg0',   memo: '🔥月｜この動画1本で分かる！営業完全マニュアル' },
  { date: '2026-06-30', url: 'https://www.youtube.com/watch?v=jgXmhW98PPI',   memo: '🎯火｜【商談の最初にこれを言え！】元キーエンスNo.1営業の認識合わせ術' },
]

async function main() {
  // 既存データを全削除（5/25〜6/30）
  console.log('=== 既存データ削除 ===')
  const { error: delErr } = await supabase
    .from('st_monthly_videos')
    .delete()
    .gte('date', '2026-05-25')
    .lte('date', '2026-06-30')
  if (delErr) { console.error('削除失敗:', delErr.message); process.exit(1) }
  console.log('✅ 既存データ削除完了\n')

  // 正しいデータを挿入
  console.log(`=== 新スケジュール登録（${videos.length}件） ===`)
  const days = ['日','月','火','水','木','金','土']
  let ok = 0, ng = 0
  for (const v of videos) {
    const [y,m,d] = v.date.split('-').map(Number)
    const dow = days[new Date(Date.UTC(y,m-1,d)).getUTCDay()]
    const { error } = await supabase
      .from('st_monthly_videos')
      .upsert({ date: v.date, video_url: v.url }, { onConflict: 'date' })
    if (error) { console.log(`❌ ${v.date}(${dow}): ${error.message}`); ng++ }
    else { console.log(`✅ ${v.date}(${dow}) ${v.memo}`); ok++ }
  }
  console.log(`\n=== 完了: 成功 ${ok}件 / 失敗 ${ng}件 ===`)
}

main().catch(console.error)
