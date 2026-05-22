import { supabase } from './supabase'
import type { DailyMetrics, WeeklyReview, DailyReport, MonthlyVideo, InstagramMetrics, StCase } from './supabase'

// ==================== Members ====================
export async function getMembers() {
  const { data, error } = await supabase
    .from('st_members')
    .select('*')
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createMember(name: string, color?: string, team?: 'top' | 'second') {
  const { data, error } = await supabase
    .from('st_members')
    .insert({ name, color: color || '#6366f1', team: team || 'top' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMember(id: string) {
  const { error } = await supabase.from('st_members').delete().eq('id', id)
  if (error) throw error
}

// ==================== Daily Metrics ====================
export async function getDailyMetrics(memberId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('st_daily_metrics')
    .select('*')
    .eq('member_id', memberId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
  if (error) throw error
  return data || []
}

export async function upsertDailyMetrics(metrics: Partial<DailyMetrics> & { member_id: string; date: string }) {
  const { data, error } = await supabase
    .from('st_daily_metrics')
    .upsert(metrics, { onConflict: 'member_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== Weekly Reviews ====================
export async function getWeeklyReview(memberId: string, weekStartDate: string) {
  const { data, error } = await supabase
    .from('st_weekly_reviews')
    .select('*')
    .eq('member_id', memberId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getWeeklyReviews(memberId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('st_weekly_reviews')
    .select('*')
    .eq('member_id', memberId)
    .gte('week_start_date', startDate)
    .lte('week_start_date', endDate)
    .order('week_start_date')
  if (error) throw error
  return data || []
}

export async function upsertWeeklyReview(review: Partial<WeeklyReview> & { member_id: string; week_start_date: string }) {
  const { data, error } = await supabase
    .from('st_weekly_reviews')
    .upsert(review, { onConflict: 'member_id,week_start_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== Daily Reports ====================
export async function getDailyReport(memberId: string, date: string) {
  const { data, error } = await supabase
    .from('st_daily_reports')
    .select('*')
    .eq('member_id', memberId)
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getDailyReports(memberId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('st_daily_reports')
    .select('*')
    .eq('member_id', memberId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsertDailyReport(report: Partial<DailyReport> & { member_id: string; date: string }) {
  const { data, error } = await supabase
    .from('st_daily_reports')
    .upsert(report, { onConflict: 'member_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== Monthly Videos ====================
export async function getMonthlyVideos(yearMonth: string) {
  // yearMonth = "2026-05"
  const startDate = `${yearMonth}-01`
  const endDate = `${yearMonth}-31`
  const { data, error } = await supabase
    .from('st_monthly_videos')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
  if (error) throw error
  return data || []
}

export async function upsertMonthlyVideo(date: string, videoUrl: string) {
  const { data, error } = await supabase
    .from('st_monthly_videos')
    .upsert({ date, video_url: videoUrl })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== Instagram ====================
export async function getInstagramAccounts(memberId?: string) {
  let q = supabase.from('st_instagram_accounts').select('*').order('created_at')
  if (memberId) q = q.eq('member_id', memberId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createInstagramAccount(accountId: string, name: string, url: string, memberId: string) {
  const { data, error } = await supabase
    .from('st_instagram_accounts')
    .insert({ id: accountId, name, url, member_id: memberId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getInstagramMetrics(accountId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('st_instagram_metrics')
    .select('*')
    .eq('account_id', accountId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
  if (error) throw error
  return data || []
}

export async function getInstagramMonthlyMetrics(accountId: string, yearMonth: string) {
  const startDate = `${yearMonth}-01`
  const endDate = `${yearMonth}-31`
  const { data, error } = await supabase
    .from('st_instagram_metrics')
    .select('*')
    .eq('account_id', accountId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
  if (error) throw error
  return data || []
}

export async function upsertInstagramMetrics(metrics: Partial<InstagramMetrics> & { account_id: string; date: string }) {
  const { data, error } = await supabase
    .from('st_instagram_metrics')
    .upsert(metrics, { onConflict: 'account_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== Settings ====================
export async function getSettings(memberId: string) {
  const { data, error } = await supabase
    .from('st_settings')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertSettings(memberId: string, goals: Record<string, number>) {
  const { data, error } = await supabase
    .from('st_settings')
    .upsert({ member_id: memberId, goals }, { onConflict: 'member_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== Member Goals ====================
export interface MemberGoalData {
  longterm_deadline: string
  longterm_content: string
  midterm_deadline: string
  midterm_content: string
  shortterm_deadline: string
  shortterm_content: string
  shortshortterm_deadline: string
  shortshortterm_content: string
  nextmonth_content: string
  thismonth_content: string
}

export async function getMemberGoals(memberId: string) {
  const { data, error } = await supabase
    .from('st_member_goals')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertMemberGoals(memberId: string, goals: Partial<MemberGoalData>) {
  const { data, error } = await supabase
    .from('st_member_goals')
    .upsert({ member_id: memberId, ...goals }, { onConflict: 'member_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ==================== Team (全メンバー一括) ====================
export async function getAllMembersMetrics(memberIds: string[], startDate: string, endDate: string) {
  if (!memberIds.length) return []
  const { data, error } = await supabase
    .from('st_daily_metrics')
    .select('*')
    .in('member_id', memberIds)
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) throw error
  return data || []
}

export async function getAllMembersSettings(memberIds: string[]) {
  if (!memberIds.length) return []
  const { data, error } = await supabase
    .from('st_settings')
    .select('*')
    .in('member_id', memberIds)
  if (error) throw error
  return data || []
}

// ==================== St Cases ====================
export async function getStCases(memberId: string) {
  const { data, error } = await supabase
    .from('st_cases')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsertStCase(c: Partial<StCase> & { member_id: string }) {
  const { data, error } = await supabase
    .from('st_cases')
    .upsert(c)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStCase(id: string) {
  const { error } = await supabase.from('st_cases').delete().eq('id', id)
  if (error) throw error
}

// ==================== Appointments (既存Supabase) ====================
export async function getActiveCases() {
  const { data, error } = await supabase
    .from('appointments')
    .select(`id,status,created_at,closer_id,notes,
      customer:customers!inner(name,cloudworks_url),
      user:profiles!appointments_user_id_fkey(id,name),
      closer:profiles!appointments_closer_id_fkey(id,name)`)
    .in('status', ['アポ獲得', '直クロ動員', '直クロフォロー', '再クロフォロー', '相談会動員', '再クロセットアップ', '動員後無着地', 'ライン交換'])
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getCancels() {
  const { data, error } = await supabase
    .from('appointments')
    .select(`id,status,cancel_reason,created_at,
      customer:customers!inner(name),
      user:profiles!appointments_user_id_fkey(id,name),
      closer:profiles!appointments_closer_id_fkey(id,name)`)
    .eq('status', '動員キャンセル')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
