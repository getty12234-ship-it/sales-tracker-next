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

// Instagramの項目
export const IG_METRIC_FIELDS = [
  { key: 'follows',     label: 'フォロー' },
  { key: 'followers',   label: 'フォロワー' },
  { key: 'dm_send',     label: 'DM送信' },
  { key: 'dm_reply',    label: 'DM返信' },
  { key: 'ig_offer',    label: 'オファー' },
  { key: 'ig_apo_get',  label: 'アポ獲得' },
  { key: 'ig_apo_exec', label: 'アポ実施' },
  { key: 'ig_doin_exec',label: '動員実施' },
  { key: 'ig_seiyaku',  label: '成約' },
]
