import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// データベースの型定義
export type Member = {
  id: string
  name: string
  color?: string
  team?: 'core' | 'top' | 'second' | 'third'
  user_id?: string | null
  is_admin?: boolean
  created_at: string
}

export type DailyMetrics = {
  id?: string
  member_id: string
  date: string // YYYY-MM-DD
  // SNS投稿・LINE
  post: number
  line_exchange: number
  // アポ
  apo_get: number
  apo_exec: number
  apo_cxl: number
  // テストクロ・オファー
  test_close: number
  offer: number
  // NG・無着地
  ng: number
  muchaku: number
  // 動員
  doin_get: number
  doin_get_cxl: number
  doin_exec: number
  doin_exec_cxl: number
  // 面談・成約
  mendan_get: number
  mendan_exec: number
  seiyaku: number
  cooling_off: number
  created_at?: string
  updated_at?: string
}

export type WeeklyReview = {
  id?: string
  member_id: string
  week_start_date: string // YYYY-MM-DD (月曜日)
  main_issue: string
  main_cause: string
  top_action: string
  cause_actions: { action: string; deadline: string }[]
  muchaku_reasons: { reason: string; count: number }[]
  ng_reasons: { reason: string; count: number }[]
  doin_muchaku_list: { date: string; customer: string; closer: string; reason: string }[]
  created_at?: string
  updated_at?: string
}

export type DailyReport = {
  id?: string
  member_id: string
  date: string
  video_url: string
  output: string
  gratitude: string
  created_at?: string
  updated_at?: string
}

export type MonthlyVideo = {
  date: string // YYYY-MM-DD
  video_url: string
}

export type InstagramAccount = {
  id: string
  name: string
  url: string
  member_id: string
  cur_followers?: number // 現在のフォロワー数（スナップショット）
  cur_follows?: number   // 現在のフォロー中数（スナップショット）
  cur_posts?: number     // 現在の投稿数（スナップショット）
  created_at?: string
}

export type InstagramMetrics = {
  id?: string
  account_id: string
  date: string
  follows: number          // フォロー（累計・ストック）
  followers: number        // フォロワー（累計・ストック）
  follow_trim: number      // フォロー削り（日次）
  follower_trim: number    // フォロワー削り（日次）
  dm_send: number          // DM送信（新規送信数）
  dm_reply: number         // DM返信（新規返信数）
  ig_offer: number         // オファー
  ig_apo_get: number       // アポ
  ig_apo_exec: number      // アポ実施（実施数）
  ig_doin_get: number      // 動員獲得
  ig_doin_exec: number     // 動員実施
  ig_seiyaku: number       // 成約
  blocked: boolean         // その日ブロックされたか
  created_at?: string
}

export type StCase = {
  id: string
  member_id: string
  customer_name: string
  next_action: string       // 次回アクション
  cu_off_care: string       // クーオフケア
  closer_name: string
  next_action_date: string  // 次回アクション日 (YYYY-MM-DD)
  notes: string
  created_at: string
}

export type KpiGoals = {
  seiyaku: number
  mendan_exec: number
  doin_exec: number
  apo_exec: number
  offer: number
  apo_get: number
  post: number
  line_exchange: number
  doin_get: number
  // 予算は b_ prefix で同じ JSONB に格納
  [key: string]: number
}

export type Settings = {
  id?: string
  member_id: string
  goals: KpiGoals
  updated_at?: string
}

// goals JSONB から予算を取り出すヘルパー
export const KPI_KEYS = ['seiyaku','mendan_exec','doin_exec','apo_exec','offer','apo_get','post','line_exchange','doin_get'] as const
export type KpiKey = typeof KPI_KEYS[number]

export function extractBudgets(goals: Record<string, number>): Record<string, number> {
  const budgets: Record<string, number> = {}
  KPI_KEYS.forEach(key => {
    budgets[key] = goals[`b_${key}`] || 0
  })
  return budgets
}

export function extractGoals(goals: Record<string, number>): Record<string, number> {
  const g: Record<string, number> = {}
  KPI_KEYS.forEach(key => {
    g[key] = goals[key] || 0
  })
  return g
}
