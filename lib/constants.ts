// 日別数字の項目定義
export type MetricField = {
  key: string
  label: string
  category: string
  color?: string
}

// ※ 並び順 = 実際の営業フロー順
export const METRIC_FIELDS: MetricField[] = [
  // 投稿
  { key: 'post',          label: '投稿',        category: '投稿' },
  // アポ
  { key: 'apo_get',       label: 'アポ獲得',    category: 'アポ' },
  { key: 'apo_exec',      label: 'アポ実施',    category: 'アポ' },
  { key: 'apo_cxl',       label: 'アポCXL',     category: 'アポ' },
  // テスト・オファー
  { key: 'test_close',    label: 'テストクロ',  category: 'テスト・オファー' },
  { key: 'offer',         label: 'オファー',    category: 'テスト・オファー' },
  // NG・無着地
  { key: 'ng',            label: 'NG',          category: 'NG・無着地' },
  { key: 'muchaku',       label: '無着地',      category: 'NG・無着地' },
  // LINE交換（動員獲得の前）
  { key: 'line_exchange', label: 'LINE交換',    category: 'LINE交換' },
  // 動員
  { key: 'doin_get',      label: '動員獲得',    category: '動員' },
  { key: 'doin_get_cxl',  label: '動員獲得CXL', category: '動員' },
  { key: 'doin_exec',     label: '動員実施',    category: '動員' },
  { key: 'doin_exec_cxl', label: '動員実施CXL', category: '動員' },
  // 面談・成約
  { key: 'mendan_get',    label: '面談獲得',    category: '面談・成約' },
  { key: 'mendan_exec',   label: '面談実施',    category: '面談・成約' },
  { key: 'seiyaku',       label: '成約',        category: '面談・成約', color: '#22c55e' },
  { key: 'cooling_off',   label: 'クーリングOFF', category: '面談・成約' },
]

export const METRIC_CATEGORIES = [
  '投稿',
  'アポ',
  'テスト・オファー',
  'NG・無着地',
  'LINE交換',
  '動員',
  '面談・成約',
]

// デフォルト目標値
export const DEFAULT_GOALS: Record<string, number> = {
  post: 30,
  apo_get: 30,
  apo_exec: 20,
  offer: 12,
  line_exchange: 60,
  doin_get: 20,
  doin_exec: 12,
  mendan_exec: 6,
  seiyaku: 3,
}

// サマリーで表示するKPI（営業フロー順：上＝起点、下＝ゴール）
export const KPI_SUMMARY = [
  { key: 'post',         label: '投稿',     color: '#ec4899', important: false },
  { key: 'apo_get',      label: 'アポ獲得', color: '#3b82f6', important: false },
  { key: 'apo_exec',     label: 'アポ実施', color: '#06b6d4', important: false },
  { key: 'offer',        label: 'オファー', color: '#f59e0b', important: false },
  { key: 'line_exchange', label: 'LINE交換', color: '#14b8a6', important: false },
  { key: 'doin_get',     label: '動員獲得', color: '#a855f7', important: false },
  { key: 'doin_exec',    label: '動員実施', color: '#8b5cf6', important: true  },
  { key: 'mendan_exec',  label: '面談実施', color: '#6366f1', important: true  },
  { key: 'seiyaku',      label: '成約',     color: '#22c55e', important: true  },
]

// メンバーカラーパレット
export const MEMBER_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899',
  '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316',
]

// Instagram 全項目（入力テーブル・月間サマリー・CSV用。スプレッドシート順）
// stock=true は累計値（合計せず最新値・純増で扱う）
export const IG_METRIC_FIELDS: { key: string; label: string; stock?: boolean }[] = [
  { key: 'follows',         label: 'フォロー',      stock: true },
  { key: 'followers',       label: 'フォロワー',    stock: true },
  { key: 'follow_trim',     label: 'フォロー削り' },
  { key: 'follower_trim',   label: 'フォロワー削り' },
  { key: 'posts',           label: '投稿数' },
  { key: 'dm_send',         label: 'DM送信' },
  { key: 'dm_reply',        label: 'DM返信' },
  { key: 'ig_apo_get',      label: 'アポ獲得' },
  { key: 'ig_apo_exec',     label: 'アポ実施' },
  { key: 'ig_apo_cxl',      label: 'アポCXL' },
  { key: 'ig_test_close',   label: 'テストクロ' },
  { key: 'ig_offer',        label: 'オファー' },
  { key: 'ig_ng',           label: 'NG' },
  { key: 'ig_muchaku',      label: '無着地' },
  { key: 'ig_line_exchange',label: 'LINE交換' },
  { key: 'ig_doin_get',     label: '動員獲得' },
  { key: 'ig_doin_get_cxl', label: '動員獲得CXL' },
  { key: 'ig_doin_exec',    label: '動員実施' },
  { key: 'ig_doin_exec_cxl',label: '動員実施CXL' },
  { key: 'ig_mendan_get',   label: '面談獲得' },
  { key: 'ig_mendan_exec',  label: '面談実施' },
  { key: 'ig_seiyaku',      label: '成約' },
  { key: 'ig_cooling_off',  label: 'クーリングOFF' },
]

// 集客ストック（累計：最新値＋純増で表示）
export const IG_STOCK_FIELDS = [
  { key: 'followers', label: 'フォロワー', color: '#f472b6' },
  { key: 'follows',   label: 'フォロー',   color: '#ec4899' },
]

// 削り（日次フロー）
export const IG_TRIM_FIELDS = [
  { key: 'follow_trim',   label: 'フォロー削り',   color: '#fb7185' },
  { key: 'follower_trim', label: 'フォロワー削り', color: '#fda4af' },
]

// 投稿（日次フロー・独立行）
export const IG_POST_FIELDS = [
  { key: 'posts', label: '投稿数', color: '#a78bfa' },
]

// Instagram ファネル（DM→成約の商談フロー順。上＝起点 / 下＝ゴール）
// 連続する段の比 = 各転換率（DM返信率・オファー率・アポ率…）
export const IG_FUNNEL = [
  { key: 'dm_send',      label: 'DM送信',   rateLabel: '起点',       color: '#60a5fa' },
  { key: 'dm_reply',     label: 'DM返信',   rateLabel: 'DM返信率',   color: '#38bdf8' },
  { key: 'ig_offer',     label: 'オファー', rateLabel: 'オファー率', color: '#f59e0b' },
  { key: 'ig_apo_get',   label: 'アポ',     rateLabel: 'アポ率',     color: '#a78bfa' },
  { key: 'ig_apo_exec',  label: 'アポ実施', rateLabel: '実施率',     color: '#06b6d4' },
  { key: 'ig_doin_get',  label: '動員',     rateLabel: '動員率',     color: '#818cf8' },
  { key: 'ig_doin_exec', label: '動員実施', rateLabel: '動員実施率', color: '#8b5cf6' },
  { key: 'ig_seiyaku',   label: '成約',     rateLabel: '成約率',     color: '#22c55e' },
]

// アクション量の週別推移チャートで描画する主要ライン（フロー）
export const IG_TREND_LINES = [
  { key: 'dm_send',     label: 'DM送信',   color: '#60a5fa' },
  { key: 'dm_reply',    label: 'DM返信',   color: '#38bdf8' },
  { key: 'ig_apo_get',  label: 'アポ',     color: '#a78bfa' },
  { key: 'ig_apo_exec', label: 'アポ実施', color: '#06b6d4' },
  { key: 'ig_seiyaku',  label: '成約',     color: '#22c55e' },
]

// Instagram メトリクスの空レコード（upsert既定値・新規行初期化）
export const IG_EMPTY_METRICS = {
  follows: 0, followers: 0, follow_trim: 0, follower_trim: 0, posts: 0,
  dm_send: 0, dm_reply: 0, ig_offer: 0, ig_apo_get: 0, ig_apo_exec: 0,
  ig_apo_cxl: 0, ig_test_close: 0, ig_ng: 0, ig_muchaku: 0, ig_line_exchange: 0,
  ig_doin_get: 0, ig_doin_get_cxl: 0, ig_doin_exec: 0, ig_doin_exec_cxl: 0,
  ig_mendan_get: 0, ig_mendan_exec: 0, ig_seiyaku: 0, ig_cooling_off: 0, blocked: false,
}

// Instagram 目標値のデフォルト（DEFAULT_GOALSのインスタ版・進捗バー用）
// 1アカ月間想定：DM 1200件（40件/日×30日）、返信10%→120、オファー60%→72、アポ→獲得1%→12
export const IG_DEFAULT_GOALS: Record<string, number> = {
  posts:        30,   // 月30投稿（1日1投稿目安）
  dm_send:      900,  // 月900件（公式：1アカ最大40件/日×平日22-25日）
  dm_reply:     90,   // 月90件（返信率10%）
  ig_offer:     40,   // 月40件
  ig_apo_get:   10,   // 月10件（公式：1アカ月間アポ獲得標準）
  ig_apo_exec:  7,    // 月7件（実施率70%）
  ig_doin_get:  3,    // 月3件
  ig_doin_exec: 2,    // 月2件
  ig_seiyaku:   1,    // 月1成約
}

// Instagram 進捗バー用KPI（サマリーと同じ形式）
export const IG_KPI_SUMMARY = [
  { key: 'posts',        label: '投稿数',    color: '#a78bfa', important: false },
  { key: 'dm_send',      label: 'DM送信',    color: '#60a5fa', important: false },
  { key: 'dm_reply',     label: 'DM返信',    color: '#38bdf8', important: false },
  { key: 'ig_offer',     label: 'オファー',  color: '#f59e0b', important: false },
  { key: 'ig_apo_get',   label: 'アポ獲得',  color: '#a78bfa', important: false },
  { key: 'ig_apo_exec',  label: 'アポ実施',  color: '#06b6d4', important: true  },
  { key: 'ig_doin_get',  label: '動員',      color: '#818cf8', important: false },
  { key: 'ig_doin_exec', label: '動員実施',  color: '#8b5cf6', important: true  },
  { key: 'ig_seiyaku',   label: '成約',      color: '#22c55e', important: true  },
]
