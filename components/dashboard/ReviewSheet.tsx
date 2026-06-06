'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getWeeklyReview, upsertWeeklyReview, getSettings, getStCases, getInstagramAccounts, getInstagramMetricsByAccounts } from '@/lib/queries'
import { getWeekDays, pct, getYearMonth, usableDays, getMonthDays, cumulativeBudgetTarget, requiredDailyFromNow, weeklyTarget, weeklyCumulativeTarget } from '@/lib/date-utils'
import { METRIC_FIELDS, DEFAULT_GOALS, KPI_SUMMARY, IG_FUNNEL } from '@/lib/constants'
import { PaceRow, PaceLegend } from './PaceBar'
import { extractBudgets } from '@/lib/supabase'
import { syncEvents } from './Header'
import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { DailyMetrics } from '@/lib/supabase'

// ホバーツールチップ付きバー（SummaryDashboard と共通ロジック）
function BarWithTooltip({ tooltip, children }: { tooltip: string; children: React.ReactNode }) {
  return (
    <div className="relative group/bar">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
        opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150
        px-2 py-1 rounded bg-slate-700 border border-slate-600 text-[10px] text-slate-200 whitespace-nowrap shadow-lg">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
      </div>
    </div>
  )
}

// --- 原因別アクションの型 ---
type CauseAction = {
  action: string
  deadline: string
  management: string
  checked: boolean
}
type CauseGroup = {
  cause: string
  actions: CauseAction[]
}

// 旧フォーマット（flat）から新フォーマット（grouped）へ移行
function migrateCauseActions(raw: any[]): CauseGroup[] {
  if (!raw || raw.length === 0) return []
  if (raw[0] && 'cause' in raw[0]) return raw as CauseGroup[]
  // 旧形式: 全アクションを1グループにまとめる
  return [{
    cause: '',
    actions: raw.map((item: any) => ({
      action: item.action || '',
      deadline: item.deadline || '',
      management: '',
      checked: false,
    })),
  }]
}

const CAUSE_COLORS = ['#eab308', '#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899']
const CAUSE_LABELS = ['1番', '2番', '3番', '4番', '5番', '6番']

// 統合実績／その他／インスタ で共通のKPI行（バー表示用）
const REVIEW_KPIS: { label: string; cw: string; ig: string; color: string; important: boolean }[] = [
  { label: 'アポ獲得', cw: 'apo_get',    ig: 'ig_apo_get',   color: '#3b82f6', important: false },
  { label: 'アポ実施', cw: 'apo_exec',   ig: 'ig_apo_exec',  color: '#06b6d4', important: true },
  { label: '動員獲得', cw: 'doin_get',   ig: 'ig_doin_get',  color: '#a855f7', important: false },
  { label: '動員実施', cw: 'doin_exec',  ig: 'ig_doin_exec', color: '#8b5cf6', important: true },
  { label: '面談実施', cw: 'mendan_exec', ig: '',            color: '#6366f1', important: true },
  { label: '成約',     cw: 'seiyaku',    ig: 'ig_seiyaku',   color: '#22c55e', important: true },
]

interface ReviewSheetProps {
  weekStart?: string
  readOnly?: boolean
  monthYm?: string // 月次KPI実績で表示する月（未指定なら週の月）。月またぎ時に「今いる月」を渡す
}

export function ReviewSheet({ weekStart: weekStartProp, readOnly = false, monthYm }: ReviewSheetProps = {}) {
  const { currentMember, currentWeekStart } = useAppState()
  const queryClient = useQueryClient()
  const weekStart = weekStartProp ?? currentWeekStart
  const weekDays = getWeekDays(weekStart)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // 月次KPIは「今いる月」を基準にする（先週ふりかえりが先月にまたいでも今月を表示）
  const ym = monthYm ?? getYearMonth(weekStart)

  const { data: metrics = [] } = useQuery({
    queryKey: ['daily_metrics', currentMember?.id, weekStart],
    queryFn: () => getDailyMetrics(currentMember!.id, weekDays[0], weekDays[6]),
    enabled: !!currentMember,
  })

  const monthDays = getMonthDays(ym)
  const { data: monthMetrics = [] } = useQuery({
    queryKey: ['daily_metrics_month', currentMember?.id, ym],
    queryFn: () => getDailyMetrics(currentMember!.id, monthDays[0], monthDays[monthDays.length - 1]),
    enabled: !!currentMember,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings', currentMember?.id],
    queryFn: () => getSettings(currentMember!.id),
    enabled: !!currentMember,
  })

  const { data: review } = useQuery({
    queryKey: ['weekly_review', currentMember?.id, weekStart],
    queryFn: () => getWeeklyReview(currentMember!.id, weekStart),
    enabled: !!currentMember,
  })

  const { data: cases = [] } = useQuery({
    queryKey: ['st_cases', currentMember?.id],
    queryFn: () => getStCases(currentMember!.id),
    enabled: !!currentMember,
  })

  // インスタサマリー用（メンバーの全アカウントを週次集計）
  const { data: igAccounts = [] } = useQuery({
    queryKey: ['ig_accounts', currentMember?.id],
    queryFn: () => getInstagramAccounts(currentMember!.id),
    enabled: !!currentMember,
  })
  const igAccountIds = igAccounts.map(a => a.id)
  const { data: igWeekMetrics = [] } = useQuery({
    queryKey: ['ig_metrics_member_week', currentMember?.id, weekStart, igAccountIds.join(',')],
    queryFn: () => getInstagramMetricsByAccounts(igAccountIds, weekDays[0], weekDays[6]),
    enabled: !!currentMember && igAccountIds.length > 0,
  })
  const igNum = (v: unknown) => (typeof v === 'number' ? v : parseInt(String(v ?? '')) || 0)
  const igSum = (key: string) => igWeekMetrics.reduce((s, m) => s + igNum((m as Record<string, unknown>)[key]), 0)
  const igFollowers = igAccounts.reduce((s, a) => s + (a.cur_followers || 0), 0)
  const igTop = igSum('dm_send')

  // 統合実績用：インスタの月次集計
  const monthDaysIg = getMonthDays(ym)
  const { data: igMonthMetrics = [] } = useQuery({
    queryKey: ['ig_metrics_member_month', currentMember?.id, ym, igAccountIds.join(',')],
    queryFn: () => getInstagramMetricsByAccounts(igAccountIds, monthDaysIg[0], monthDaysIg[monthDaysIg.length - 1]),
    enabled: !!currentMember && igAccountIds.length > 0,
  })
  const igMonthSum = (key: string) => igMonthMetrics.reduce((s, m) => s + igNum((m as Record<string, unknown>)[key]), 0)

  const { mutateAsync: save } = useMutation({
    mutationFn: upsertWeeklyReview,
    onSuccess: (data) => {
      queryClient.setQueryData(['weekly_review', currentMember?.id, weekStart], data)
      // SummaryDashboard 月次集計の無着地/NG理由ランキングも最新化
      queryClient.invalidateQueries({ queryKey: ['weekly_reviews_month', currentMember?.id] })
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  const [form, setForm] = useState({
    main_issue: '',
    main_cause: '',
    top_action: '',
    cause_groups: [] as CauseGroup[],
    muchaku_reasons: [] as { reason: string; count: number }[],
    ng_reasons: [] as { reason: string; count: number }[],
    doin_muchaku_list: [] as { date: string; customer: string; closer: string; reason: string }[],
  })

  // 週/メンバーが切り替わった時だけフォームを同期する。
  // ※ 保存由来の review 更新ではフォームを上書きしない（編集中の取りこぼし防止）。
  // ※ ガードなしで review に依存すると、データの無い週で前週の内容が残り、
  //    編集時に別の週へ保存されて全週が同一化する不具合になる（それを防ぐ）。
  const loadedKey = useRef<string | undefined>(undefined)
  const loadKey = `${currentMember?.id}_${weekStart}`
  useEffect(() => {
    if (review === undefined) return            // まだ読み込み中
    if (loadedKey.current === loadKey) return    // この週は同期済み → 上書きしない
    loadedKey.current = loadKey
    setForm({
      main_issue: review?.main_issue || '',
      main_cause: review?.main_cause || '',
      top_action: review?.top_action || '',
      cause_groups: migrateCauseActions((review?.cause_actions as any) || []),
      muchaku_reasons: (review?.muchaku_reasons as any) || [],
      ng_reasons: (review?.ng_reasons as any) || [],
      doin_muchaku_list: (review?.doin_muchaku_list as any) || [],
    })
  }, [review, loadKey])

  const debouncedSave = (updates: Partial<typeof form>) => {
    if (!currentMember) return
    const next = { ...form, ...updates }
    setForm(next)
    syncEvents.emit('saving')

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save({
        member_id: currentMember.id,
        week_start_date: weekStart,
        main_issue: next.main_issue,
        main_cause: next.main_cause,
        top_action: next.top_action,
        cause_actions: next.cause_groups as any, // cause_groupsをcause_actionsカラムに保存
        muchaku_reasons: next.muchaku_reasons,
        ng_reasons: next.ng_reasons,
        doin_muchaku_list: next.doin_muchaku_list,
      })
    }, 800)
  }

  const rawGoals = (settings?.goals as Record<string, number>) || {}
  const goalVals: Record<string, number> = { ...DEFAULT_GOALS, ...rawGoals }
  const budgets = extractBudgets(rawGoals)

  const totals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    totals[key] = metrics.reduce((sum, m) => sum + ((m[key as keyof DailyMetrics] as number) || 0), 0)
  })

  const monthTotals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    monthTotals[key] = monthMetrics.reduce((sum, m) => sum + ((m[key as keyof DailyMetrics] as number) || 0), 0)
  })

  // ===== 週次バー表示用：月の予算/目標を平日按分して「この週の予算/目標」に変換 =====
  const wkTgt = (monthly: number) => weeklyTarget(monthly, weekStart)       // この週フルの目安
  const wkPace = (monthly: number) => weeklyCumulativeTarget(monthly, weekStart) // 今(今週/先週)ここまでの目安
  const cwBudget = (cw: string) => budgets[cw] || 0
  const cwGoal = (cw: string) => goalVals[cw] || 0
  const igBud = (ig: string) => (ig ? (rawGoals[`b_${ig}`] ?? 0) : 0)
  const igGl = (ig: string) => (ig ? (rawGoals[ig] ?? 0) : 0)
  const paceWord = readOnly ? '先週' : '今週'

  if (!currentMember) {
    return <div className="text-slate-500 text-sm p-8 text-center">メンバーを選択してください</div>
  }

  return (
    <div className={`grid grid-cols-1 xl:grid-cols-3 gap-4 ${readOnly ? 'opacity-80' : ''}`}>
      {/* ===== 左列: KPI・実績・内訳 ===== */}
      <div className="xl:col-span-1 space-y-3">

        {/* ① 統合実績（その他＋インスタ・今週/先週・バー表示） */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                📊 統合実績
                <span className="text-xs font-normal text-slate-500">{paceWord}・その他＋インスタ合算</span>
              </CardTitle>
              <PaceLegend paceWord={paceWord} />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-0.5">
            {REVIEW_KPIS.map(r => {
              const o = totals[r.cw] || 0
              const i = r.ig ? igSum(r.ig) : 0
              const val = o + i
              const monthBudget = cwBudget(r.cw) + igBud(r.ig)
              const monthGoal = cwGoal(r.cw) + igGl(r.ig)
              return (
                <PaceRow
                  key={r.label}
                  label={r.label}
                  value={val}
                  budget={wkTgt(monthBudget)}
                  goal={wkTgt(monthGoal)}
                  budgetPace={wkPace(monthBudget)}
                  goalPace={wkPace(monthGoal)}
                  color={r.color}
                  important={r.important}
                />
              )
            })}
          </CardContent>
        </Card>

        {/* ② その他の獲得方法（クラウドワークス等・今週/先週・バー表示） */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                🗂 その他の獲得方法
                <span className="text-xs font-normal text-slate-500">{paceWord}・クラウドワークス等</span>
              </CardTitle>
              <PaceLegend paceWord={paceWord} />
            </div>
          </CardHeader>
          <CardContent className="space-y-0.5 p-3 pt-0">
            {REVIEW_KPIS.map(r => {
              const val = totals[r.cw] || 0
              return (
                <PaceRow
                  key={r.cw}
                  label={r.label}
                  value={val}
                  budget={wkTgt(cwBudget(r.cw))}
                  goal={wkTgt(cwGoal(r.cw))}
                  budgetPace={wkPace(cwBudget(r.cw))}
                  goalPace={wkPace(cwGoal(r.cw))}
                  color={r.color}
                  important={r.important}
                />
              )
            })}
            <div className="pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
              {[
                { label: '無着地率',   value: pct(totals.muchaku, totals.apo_exec),  color: '#f87171' },
                { label: 'NG率',       value: pct(totals.ng,      totals.apo_exec),  color: '#fb923c' },
                { label: 'オファー率', value: pct(totals.offer,   totals.apo_exec),  color: '#f59e0b' },
                { label: '成約率',     value: pct(totals.seiyaku, totals.doin_exec), color: '#22c55e' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-0.5">
                  <span className="text-[10px] text-slate-500">{label}</span>
                  <span className="text-xs font-bold" style={{ color }}>{value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ②.5 インスタサマリー（アカウントがある場合のみ） */}
        {igAccounts.length > 0 && (
          <Card className="bg-slate-900 border-pink-900/30 border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  📷 インスタ
                  <span className="text-xs font-normal text-slate-500">{readOnly ? '先週' : '今週'}・{igAccounts.length}アカウント</span>
                </span>
                <span className="text-xs font-normal text-slate-400">
                  フォロワー <span className="text-pink-300 font-bold">{igFollowers.toLocaleString()}</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 p-3 pt-0">
              <div className="flex justify-end pb-1">
                <PaceLegend paceWord={paceWord} />
              </div>
              {REVIEW_KPIS.filter(r => r.ig).map(r => {
                const val = igSum(r.ig)
                return (
                  <PaceRow
                    key={r.ig}
                    label={r.label}
                    value={val}
                    budget={wkTgt(igBud(r.ig))}
                    goal={wkTgt(igGl(r.ig))}
                    budgetPace={wkPace(igBud(r.ig))}
                    goalPace={wkPace(igGl(r.ig))}
                    color={r.color}
                    important={r.important}
                  />
                )
              })}
              {/* 集客の土台（予算対象外）＋転換率 */}
              <div className="pt-2 mt-1 border-t border-slate-800/60 flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                <span>DM送信 <span className="text-slate-300 font-bold">{igSum('dm_send')}</span></span>
                <span>→ 返信 <span className="text-slate-300 font-bold">{igSum('dm_reply')}</span></span>
                <span className="text-sky-400">返信率 {pct(igSum('dm_reply'), igSum('dm_send'))}%</span>
              </div>
              <div className="pt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {[
                  { label: 'アポ率',     value: pct(igSum('ig_apo_get'), igSum('ig_offer')),     color: '#a78bfa' },
                  { label: '成約率',     value: pct(igSum('ig_seiyaku'), igSum('ig_doin_exec')), color: '#22c55e' },
                  { label: '全体成約率', value: pct(igSum('ig_seiyaku'), igSum('dm_send')),      color: '#ec4899' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center py-0.5">
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <span className="text-xs font-bold" style={{ color }}>{value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ③ 無着地打ち分け */}
        <Card className="bg-slate-900 border-red-900/30 border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-1.5">
                😶 無着地打ち分け
                <span className="text-xs font-normal text-slate-500">計{totals.muchaku || 0}件</span>
              </CardTitle>
              {!readOnly && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-slate-500 hover:text-slate-300"
                  onClick={() => debouncedSave({ muchaku_reasons: [...form.muchaku_reasons, { reason: '', count: 0 }] })}>
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            {form.muchaku_reasons.length === 0 && (
              <p className="text-xs text-slate-600">{readOnly ? '（記録なし）' : '＋で追加、または日別入力の？から'}</p>
            )}
            {form.muchaku_reasons.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
                {readOnly ? (
                  <span className="text-xs text-slate-300 flex-1 truncate">{item.reason || '（未記入）'}</span>
                ) : (
                  <Input
                    className="bg-slate-950 border-slate-700 text-xs h-6 flex-1"
                    value={item.reason}
                    onChange={e => {
                      const next = [...form.muchaku_reasons]
                      next[i] = { ...next[i], reason: e.target.value }
                      debouncedSave({ muchaku_reasons: next })
                    }}
                    placeholder="理由"
                  />
                )}
                {!readOnly ? (
                  <Input
                    type="number"
                    className="bg-slate-950 border-slate-700 text-xs h-6 w-12 text-center"
                    value={item.count || ''}
                    onChange={e => {
                      const next = [...form.muchaku_reasons]
                      next[i] = { ...next[i], count: parseInt(e.target.value) || 0 }
                      debouncedSave({ muchaku_reasons: next })
                    }}
                    placeholder="0"
                  />
                ) : (
                  <span className="text-sm font-bold text-red-400 w-8 text-right">{item.count}</span>
                )}
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-400"
                    onClick={() => debouncedSave({ muchaku_reasons: form.muchaku_reasons.filter((_, j) => j !== i) })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            {/* 最多理由 */}
            {form.muchaku_reasons.length > 0 && (() => {
              const top = [...form.muchaku_reasons].filter(r => r.count > 0).sort((a, b) => b.count - a.count)[0]
              if (!top) return null
              return (
                <div className="mt-1 pt-1 border-t border-slate-800/60">
                  <span className="text-[10px] text-amber-400">最多: </span>
                  <span className="text-[10px] text-white">{top.reason}（{top.count}件）</span>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* ④ NG打ち分け */}
        <Card className="bg-slate-900 border-orange-900/30 border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-1.5">
                ❌ NG打ち分け
                <span className="text-xs font-normal text-slate-500">計{totals.ng || 0}件</span>
              </CardTitle>
              {!readOnly && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-slate-500 hover:text-slate-300"
                  onClick={() => debouncedSave({ ng_reasons: [...form.ng_reasons, { reason: '', count: 0 }] })}>
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            {form.ng_reasons.length === 0 && (
              <p className="text-xs text-slate-600">{readOnly ? '（記録なし）' : '＋で追加、または日別入力の？から'}</p>
            )}
            {form.ng_reasons.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0 bg-orange-400" />
                {readOnly ? (
                  <span className="text-xs text-slate-300 flex-1 truncate">{item.reason || '（未記入）'}</span>
                ) : (
                  <Input
                    className="bg-slate-950 border-slate-700 text-xs h-6 flex-1"
                    value={item.reason}
                    onChange={e => {
                      const next = [...form.ng_reasons]
                      next[i] = { ...next[i], reason: e.target.value }
                      debouncedSave({ ng_reasons: next })
                    }}
                    placeholder="理由"
                  />
                )}
                {!readOnly ? (
                  <Input
                    type="number"
                    className="bg-slate-950 border-slate-700 text-xs h-6 w-12 text-center"
                    value={item.count || ''}
                    onChange={e => {
                      const next = [...form.ng_reasons]
                      next[i] = { ...next[i], count: parseInt(e.target.value) || 0 }
                      debouncedSave({ ng_reasons: next })
                    }}
                    placeholder="0"
                  />
                ) : (
                  <span className="text-sm font-bold text-orange-400 w-8 text-right">{item.count}</span>
                )}
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-400"
                    onClick={() => debouncedSave({ ng_reasons: form.ng_reasons.filter((_, j) => j !== i) })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ⑤ 継続案件 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-1.5">
              🔁 継続案件
              <span className="text-xs font-normal text-slate-500">{cases.length}件</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            {cases.length === 0 && <p className="text-xs text-slate-600">案件なし</p>}
            {cases.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-0.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-200 flex-1 truncate">{c.customer_name}</span>
                <span className="text-[10px] text-slate-600 shrink-0">{c.next_action_date}</span>
              </div>
            ))}
            {cases.length > 8 && <p className="text-[10px] text-slate-600 pt-1">他 {cases.length - 8}件...</p>}
          </CardContent>
        </Card>

      </div>

      {/* ===== 右列: 施策シートフォーム ===== */}
      <div className="xl:col-span-2 space-y-4">

        {/* メイン課題 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">{readOnly ? '先週の' : '今週の'}メイン課題</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">課題</label>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-16 resize-none"
                value={form.main_issue}
                onChange={e => !readOnly && debouncedSave({ main_issue: e.target.value })}
                readOnly={readOnly}
                placeholder={readOnly ? '（記録なし）' : '今週の最大の課題を記入...'}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">原因</label>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-16 resize-none"
                value={form.main_cause}
                onChange={e => !readOnly && debouncedSave({ main_cause: e.target.value })}
                readOnly={readOnly}
                placeholder={readOnly ? '（記録なし）' : '課題の根本原因...'}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">最重要アクション</label>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-12 resize-none"
                value={form.top_action}
                onChange={e => !readOnly && debouncedSave({ top_action: e.target.value })}
                readOnly={readOnly}
                placeholder={readOnly ? '（記録なし）' : '来週最も優先して取り組むこと...'}
              />
            </div>
          </CardContent>
        </Card>

        {/* 原因別アクション（交互表示） */}
        <CauseGroupList
          groups={form.cause_groups}
          readOnly={readOnly}
          onChange={groups => debouncedSave({ cause_groups: groups })}
        />

        {/* キャンセル・動員後無着地リスト */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300">
                キャンセル・動員後無着地 ({form.doin_muchaku_list.length}件)
              </CardTitle>
              {!readOnly && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300"
                  onClick={() => debouncedSave({
                    doin_muchaku_list: [...form.doin_muchaku_list, { date: '', customer: '', closer: '', reason: '' }]
                  })}>
                  <Plus className="w-3.5 h-3.5 mr-1" />追加
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {form.doin_muchaku_list.length === 0 && (
              <p className="text-xs text-slate-600">{readOnly ? '（記録なし）' : '追加ボタンで入力'}</p>
            )}
            {form.doin_muchaku_list.map((item, i) => (
              <div key={i} className="flex gap-2 items-center flex-wrap">
                <Input className="bg-slate-950 border-slate-700 text-xs h-7 w-24"
                  value={item.date} readOnly={readOnly} placeholder="日付"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], date: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }} />
                <Input className="bg-slate-950 border-slate-700 text-xs h-7 flex-1 min-w-[80px]"
                  value={item.customer} readOnly={readOnly} placeholder="顧客名"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], customer: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }} />
                <Input className="bg-slate-950 border-slate-700 text-xs h-7 w-20"
                  value={item.closer} readOnly={readOnly} placeholder="クローザー"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], closer: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }} />
                <Input className="bg-slate-950 border-slate-700 text-xs h-7 flex-1 min-w-[80px]"
                  value={item.reason} readOnly={readOnly} placeholder="無着地理由"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], reason: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }} />
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-400 shrink-0"
                    onClick={() => debouncedSave({ doin_muchaku_list: form.doin_muchaku_list.filter((_, j) => j !== i) })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

// ===== 原因別アクションリスト（交互表示）コンポーネント =====
function CauseGroupList({
  groups,
  readOnly,
  onChange,
}: {
  groups: CauseGroup[]
  readOnly: boolean
  onChange: (groups: CauseGroup[]) => void
}) {
  const addGroup = () => {
    onChange([...groups, { cause: '', actions: [] }])
  }

  const removeGroup = (gi: number) => {
    onChange(groups.filter((_, i) => i !== gi))
  }

  const updateGroupCause = (gi: number, cause: string) => {
    const next = [...groups]
    next[gi] = { ...next[gi], cause }
    onChange(next)
  }

  const addAction = (gi: number) => {
    const next = [...groups]
    next[gi] = {
      ...next[gi],
      actions: [...next[gi].actions, { action: '', deadline: '', management: '', checked: false }],
    }
    onChange(next)
  }

  const updateAction = (gi: number, ai: number, updates: Partial<CauseAction>) => {
    const next = [...groups]
    const actions = [...next[gi].actions]
    actions[ai] = { ...actions[ai], ...updates }
    next[gi] = { ...next[gi], actions }
    onChange(next)
  }

  const removeAction = (gi: number, ai: number) => {
    const next = [...groups]
    next[gi] = { ...next[gi], actions: next[gi].actions.filter((_, i) => i !== ai) }
    onChange(next)
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300">原因の原因</CardTitle>
          {!readOnly && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-400 hover:text-indigo-300" onClick={addGroup}>
              <Plus className="w-3.5 h-3.5 mr-1" />原因追加
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0">
        {groups.length === 0 && (
          <p className="text-xs text-slate-600">{readOnly ? '（記録なし）' : '「原因追加」で入力'}</p>
        )}
        {groups.map((group, gi) => {
          const color = CAUSE_COLORS[gi % CAUSE_COLORS.length]
          const label = CAUSE_LABELS[gi] || `${gi + 1}番`
          return (
            <div key={gi} className="rounded-lg border border-slate-700/40 overflow-hidden">
              {/* 原因ヘッダー行 */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: `${color}15`, borderLeft: `3px solid ${color}` }}
              >
                <span className="text-xs font-bold shrink-0 w-8" style={{ color }}>{label}</span>
                {readOnly ? (
                  <span className="text-sm text-slate-200 flex-1">{group.cause || '（原因未記入）'}</span>
                ) : (
                  <Input
                    className="bg-transparent border-0 text-sm text-slate-100 h-7 flex-1 px-1 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                    value={group.cause}
                    onChange={e => updateGroupCause(gi, e.target.value)}
                    placeholder={`原因${gi + 1}を入力`}
                  />
                )}
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-400 shrink-0"
                    onClick={() => removeGroup(gi)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* 対策（アクション）一覧 */}
              <div className="px-3 py-2 space-y-2 bg-slate-950/20">
                {group.actions.length === 0 && (
                  <p className="text-xs text-slate-600">{readOnly ? '（対策なし）' : '「対策追加」で入力'}</p>
                )}
                {group.actions.map((act, ai) => (
                  <div key={ai} className="space-y-1 pl-2 border-l border-slate-700/40">
                    {/* アクション行 */}
                    <div className="flex gap-2 items-center">
                      {!readOnly && (
                        <input
                          type="checkbox"
                          checked={act.checked}
                          onChange={e => updateAction(gi, ai, { checked: e.target.checked })}
                          className="w-3.5 h-3.5 shrink-0 accent-indigo-500 cursor-pointer"
                        />
                      )}
                      {readOnly ? (
                        <span className={`text-xs flex-1 ${act.checked ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {act.action || '（未記入）'}
                        </span>
                      ) : (
                        <Input
                          className="bg-slate-950 border-slate-700 text-xs h-7 flex-1"
                          value={act.action}
                          onChange={e => updateAction(gi, ai, { action: e.target.value })}
                          placeholder="対策内容"
                        />
                      )}
                      {readOnly ? (
                        <span className="text-[10px] text-slate-500 shrink-0">{act.deadline}</span>
                      ) : (
                        <Input
                          className="bg-slate-950 border-slate-700 text-xs h-7 w-24 shrink-0"
                          value={act.deadline}
                          onChange={e => updateAction(gi, ai, { deadline: e.target.value })}
                          placeholder="期限"
                        />
                      )}
                      {!readOnly && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-400 shrink-0"
                          onClick={() => removeAction(gi, ai)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {/* 管理方法行 */}
                    <div className="flex items-center gap-2 pl-5">
                      <span className="text-[10px] text-slate-500 shrink-0">管理方法:</span>
                      {readOnly ? (
                        <span className="text-[10px] text-slate-400">{act.management || '—'}</span>
                      ) : (
                        <Input
                          className="bg-slate-950/60 border-slate-800 text-[10px] h-6 flex-1 text-slate-400 placeholder:text-slate-700"
                          value={act.management}
                          onChange={e => updateAction(gi, ai, { management: e.target.value })}
                          placeholder="管理方法を自由記述"
                        />
                      )}
                    </div>
                  </div>
                ))}
                {!readOnly && (
                  <Button variant="ghost" size="sm"
                    className="h-6 text-[11px] text-slate-500 hover:text-indigo-300 px-1"
                    onClick={() => addAction(gi)}>
                    <Plus className="w-3 h-3 mr-0.5" />対策追加
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
