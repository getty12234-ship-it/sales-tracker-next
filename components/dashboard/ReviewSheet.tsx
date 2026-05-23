'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getWeeklyReview, upsertWeeklyReview, getSettings, getStCases } from '@/lib/queries'
import { getWeekDays, pct, getYearMonth, usableDays, getMonthDays, cumulativeBudgetTarget, requiredDailyFromNow } from '@/lib/date-utils'
import { METRIC_FIELDS, DEFAULT_GOALS, KPI_SUMMARY } from '@/lib/constants'
import { extractBudgets } from '@/lib/supabase'
import { syncEvents } from './Header'
import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { DailyMetrics } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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

interface ReviewSheetProps {
  weekStart?: string
  readOnly?: boolean
}

export function ReviewSheet({ weekStart: weekStartProp, readOnly = false }: ReviewSheetProps = {}) {
  const { currentMember, currentWeekStart } = useAppState()
  const queryClient = useQueryClient()
  const weekStart = weekStartProp ?? currentWeekStart
  const weekDays = getWeekDays(weekStart)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const ym = getYearMonth(weekStart)

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

  useEffect(() => {
    if (review) {
      setForm({
        main_issue: review.main_issue || '',
        main_cause: review.main_cause || '',
        top_action: review.top_action || '',
        cause_groups: migrateCauseActions((review.cause_actions as any) || []),
        muchaku_reasons: (review.muchaku_reasons as any) || [],
        ng_reasons: (review.ng_reasons as any) || [],
        doin_muchaku_list: (review.doin_muchaku_list as any) || [],
      })
    }
  }, [review])

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

  if (!currentMember) {
    return <div className="text-slate-500 text-sm p-8 text-center">メンバーを選択してください</div>
  }

  return (
    <div className={`grid grid-cols-1 xl:grid-cols-3 gap-4 ${readOnly ? 'opacity-80' : ''}`}>
      {/* ===== 左列: KPI・実績・内訳 ===== */}
      <div className="xl:col-span-1 space-y-3">

        {/* ① 月次KPIサマリー */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              📊 月次KPI実績
              <span className="text-xs font-normal text-slate-500">{ym.replace('-', '年')}月</span>
              {readOnly && <span className="text-xs font-normal text-slate-600">（読み取り専用）</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-3 gap-1.5">
              {KPI_SUMMARY.map(({ key, label, color, important }) => {
                const val = monthTotals[key] || 0
                const budget = budgets[key] || 0
                const goal = goalVals[key] || 0
                const rate = pct(val, goal)
                const progressColor = rate >= 100 ? '#22c55e' : rate >= 70 ? '#eab308' : '#ef4444'
                // ペース（予算あり→予算ベース、なし→目標ベース）
                const paceBase = budget > 0 ? budget : goal
                const cumTarget = paceBase > 0 ? cumulativeBudgetTarget(paceBase, ym) : 0
                const reqDaily = paceBase > 0 ? requiredDailyFromNow(paceBase, val, ym) : 0
                const isOnTrack = cumTarget > 0 ? val >= cumTarget : true
                const paceGap = cumTarget > 0 ? Math.round(val - cumTarget) : 0
                return (
                  <div key={key} className={`rounded-lg p-2 ${important ? 'bg-slate-800 ring-1 ring-indigo-500/20' : 'bg-slate-800/50'}`}>
                    <div className="text-[10px] text-slate-500 truncate mb-0.5">{label}</div>
                    <div className="text-lg font-bold leading-tight" style={{ color }}>{val}</div>
                    {budget > 0 ? (
                      <div className="text-[10px] leading-tight">
                        <span className="text-amber-400">予{budget}</span>
                        <span className="text-slate-600 ml-0.5">目{goal}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600">目標 {goal}</div>
                    )}
                    <div className="w-full h-1 bg-slate-700 rounded-full mt-1.5">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, rate)}%`, background: progressColor }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px]" style={{ color: progressColor }}>{rate}%</span>
                      {val >= paceBase && paceBase > 0 ? (
                        <span className="text-[9px] text-green-400">✓達成</span>
                      ) : reqDaily > 0 ? (
                        <span className={`text-[9px] ${isOnTrack ? 'text-slate-500' : 'text-red-400'}`}>{reqDaily}/日</span>
                      ) : null}
                    </div>
                    {/* ペース表示（今日目標） */}
                    {cumTarget > 0 && (
                      <div className={`text-[9px] mt-0.5 font-medium ${isOnTrack ? 'text-cyan-500' : 'text-red-400'}`}>
                        今日目標{cumTarget} {isOnTrack ? `+${paceGap}` : `${paceGap}`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ② 今週の収支実績 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">今週の収支実績</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3 pt-0">
            {[
              { key: 'apo_get',     label: 'アポ獲得',  color: '#3b82f6' },
              { key: 'apo_exec',    label: 'アポ実施',  color: '#06b6d4' },
              { key: 'offer',       label: 'オファー',  color: '#f59e0b' },
              { key: 'doin_exec',   label: '動員実施',  color: '#8b5cf6' },
              { key: 'mendan_exec', label: '面談実施',  color: '#6366f1' },
              { key: 'seiyaku',     label: '成約',      color: '#22c55e' },
              { key: 'ng',          label: 'NG',        color: '#fb923c' },
              { key: 'muchaku',     label: '無着地',    color: '#f87171' },
            ].map(({ key, label, color }) => {
              const weekVal = totals[key] || 0
              const monthVal = monthTotals[key] || 0
              const goal = goalVals[key] || 0
              const weekShare = goal > 0 ? Math.round((weekVal / goal) * 100) : 0
              return (
                <div key={key} className="flex items-center gap-2 py-0.5 border-b border-slate-800/60">
                  <span className="text-xs w-16 shrink-0" style={{ color }}>{label}</span>
                  <span className="text-sm font-bold text-slate-100 w-6 text-right shrink-0">{weekVal}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, weekShare)}%`, background: color }} />
                  </div>
                  <span className="text-[10px] text-slate-500 w-12 text-right shrink-0">月計 {monthVal}</span>
                </div>
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

        {/* ⑤ ターン案件・動員 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-1.5">
              🔄 ターン案件・動員
              <span className="text-xs font-normal text-slate-500">{cases.length}件</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            {cases.length === 0 && <p className="text-xs text-slate-600">案件なし</p>}
            {cases.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-0.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-200 flex-1 truncate">{c.customer_name}</span>
                <span className="text-[10px] text-indigo-400 shrink-0 truncate max-w-[80px]">{c.next_action}</span>
                <span className="text-[10px] text-slate-600 shrink-0">{c.next_action_date}</span>
              </div>
            ))}
            {cases.length > 8 && <p className="text-[10px] text-slate-600 pt-1">他 {cases.length - 8}件...</p>}
          </CardContent>
        </Card>

        {/* ⑥ 曜日別グラフ */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">曜日別 アポ・動員・成約</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {(() => {
              const dayLabels = ['月', '火', '水', '木', '金', '土', '日']
              const chartData = weekDays.map((date, i) => {
                const m = metrics.find(d => d.date === date)
                return {
                  day: dayLabels[i],
                  アポ獲得: m?.apo_get || 0,
                  動員実施: m?.doin_exec || 0,
                  成約: m?.seiyaku || 0,
                }
              })
              return (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }} />
                    <Bar dataKey="アポ獲得" fill="#6366f1" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="動員実施" fill="#8b5cf6" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="成約" fill="#22c55e" radius={[2,2,0,0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )
            })()}
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
          <CardTitle className="text-sm text-slate-300">原因別アクションリスト</CardTitle>
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
