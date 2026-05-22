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
  team?: 'top' | 'second'
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
  created_at?: string
}

export type InstagramMetrics = {
  id?: string
  account_id: string
  date: string
  follows: number
  followers: number
  dm_send: number
  dm_reply: number
  ig_offer: number
  ig_apo_get: number
  ig_apo_exec: number
  ig_doin_exec: number
  ig_seiyaku: number
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

export type Settings = {
  id?: string
  member_id: string
  goals: {
    seiyaku: number
    mendan_exec: number
    doin_exec: number
    apo_exec: number
    offer: number
    apo_get: number
    post: number
    line_exchange: number
    doin_get: number
  }
  updated_at?: string
}
