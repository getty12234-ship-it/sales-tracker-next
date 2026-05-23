'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getSettings, getStCases, upsertStCase, deleteStCase, getWeeklyReviews } from '@/lib/queries'
import { getMonthDays, currentYearMonth, pct, remainingWorkdays, passedWorkdays, totalWorkdays, usableDays, dailyBudgetRate, cumulativeBudgetTarget, requiredDailyFromNow } from '@/lib/date-utils'
import { KPI_SUMMARY, DEFAULT_GOALS, METRIC_FIELDS } from '@/lib/constants'
import type { DailyMetrics, StCase } from '@/lib/supabase'
import { extractBudgets } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Target, Calendar, Download, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const NEXT_ACTION_OPTIONS = [
  'T-UP',
  '直クロセットアップ',
  '直クロフォロー',
  '再クロセットアップ',
  '再クロフォロー',
  '面談セットアップ',
  '面談フォロー',
  'クーオフケア',
]

export function SummaryDashboard() {
  const { currentMember, currentYearMonth: ym } = useAppState()
  const monthDays = getMonthDays(ym)
  const queryClient = useQueryClient()

  // 新規案件入力state
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newNextAction, setNewNextAction] = useState(NEXT_ACTION_OPTIONS[0])
  const [newCloserName, setNewCloserName] = useState('')
  const [newNextActionDate, setNewNextActionDate] = useState('')

  const { data: metrics = [] } = useQuery({
    queryKey: ['daily_metrics', currentMember?.id, ym],
    queryFn: () => getDailyMetrics(currentMember!.id, monthDays[0], monthDays[monthDays.length - 1]),
    enabled: !!currentMember,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings', currentMember?.id],
    queryFn: () => getSettings(currentMember!.id),
    enabled: !!currentMember,
  })

  const { data: activeCases = [] } = useQuery({
    queryKey: ['st_cases', currentMember?.id],
    queryFn: () => getStCases(currentMember!.id),
    enabled: !!currentMember,
  })

  const addCaseMutation = useMutation({
    mutationFn: (c: Partial<StCase> & { member_id: string }) => upsertStCase(c),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['st_cases', currentMember?.id] })
      setNewCustomerName('')
      setNewNextAction(NEXT_ACTION_OPTIONS[0])
      setNewCloserName('')
      setNewNextActionDate('')
    },
  })

  const deleteCaseMutation = useMutation({
    mutationFn: (id: string) => deleteStCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['st_cases', currentMember?.id] })
    },
  })

  const handleAddCase = () => {
    if (!currentMember || !newCustomerName.trim()) return
    addCaseMutation.mutate({
      member_id: currentMember.id,
      customer_name: newCustomerName.trim(),
      next_action: newNextAction,
      cu_off_care: '',
      closer_name: newCloserName.trim(),
      next_action_date: newNextActionDate || undefined,
      notes: '',
    })
  }

  const { data: weeklyReviews = [] } = useQuery({
    queryKey: ['weekly_reviews_month', currentMember?.id, ym],
    queryFn: () => getWeeklyReviews(currentMember!.id, `${ym}-01`, `${ym}-31`),
    enabled: !!currentMember,
  })

  if (!currentMember) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        メンバーを選択してください
      </div>
    )
  }

  // 月間合計
  const totals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    totals[key] = metrics.reduce((sum, m) => sum + ((m[key as keyof DailyMetrics] as number) || 0), 0)
  })

  const rawGoals = (settings?.goals as Record<string, number>) || {}
  const goals = { ...DEFAULT_GOALS, ...rawGoals }
  const budgets = extractBudgets(rawGoals)
  const hasBudgets = Object.values(budgets).some(v => v > 0)
  const remaining = remainingWorkdays(ym)
  const passed = passedWorkdays(ym)
  const total = totalWorkdays(ym)

  // 無着地・NG理由集計
  const muchaReasonMap: Record<string, number> = {}
  const ngReasonMap: Record<string, number> = {}
  weeklyReviews.forEach(r => {
    ;((r.muchaku_reasons as { reason: string; count: number }[]) || []).forEach(({ reason, count }) => {
      if (reason) muchaReasonMap[reason] = (muchaReasonMap[reason] || 0) + count
    })
    ;((r.ng_reasons as { reason: string; count: number }[]) || []).forEach(({ reason, count }) => {
      if (reason) ngReasonMap[reason] = (ngReasonMap[reason] || 0) + count
    })
  })
  const muchaReasons = Object.entries(muchaReasonMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const ngReasons = Object.entries(ngReasonMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // CSVエクスポート
  const exportCSV = () => {
    const headers = ['日付', ...METRIC_FIELDS.map(f => f.label)]
    const rows = metrics.map(m => [
      m.date,
      ...METRIC_FIELDS.map(f => String((m[f.key as keyof DailyMetrics] as number) || 0))
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_${ym}_${currentMember.name}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 週別チャートデータ
  const weeklyData = buildWeeklyChartData(metrics)

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">
          {ym.replace('-', '年')}月 サマリー
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            残り営業日: <span className="text-slate-200 font-semibold">{remaining}日</span>
            <span className="text-slate-600">/ {total}日</span>
          </div>
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs text-slate-400 hover:text-slate-200 border border-slate-700"
            onClick={exportCSV}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {KPI_SUMMARY.map(({ key, label, color, important }) => {
          const val = totals[key] || 0
          const goal = goals[key] || 0
          const budget = budgets[key] || 0
          const rate = pct(val, goal)
          const daily = passed > 0 ? (val / passed).toFixed(1) : '0'
          const needPerDay = remaining > 0 ? Math.ceil(Math.max(0, goal - val) / remaining) : 0
          // ペース（予算あり→予算ベース、なし→目標ベース）
          const paceBase = budget > 0 ? budget : goal
          const cumTarget = paceBase > 0 ? cumulativeBudgetTarget(paceBase, ym) : 0
          const reqDaily = paceBase > 0 ? requiredDailyFromNow(paceBase, val, ym) : 0

          return (
            <KpiCard
              key={key}
              label={label}
              value={val}
              goal={goal}
              budget={budget}
              rate={rate}
              color={color}
              daily={daily}
              needPerDay={needPerDay}
              important={important}
              cumulativeTarget={cumTarget}
              requiredDailyBudget={reqDaily}
            />
          )
        })}
      </div>

      {/* 予算ペース分析パネル */}
      {hasBudgets && (
        <Card className="bg-slate-900 border-slate-800 border-amber-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
              📊 予算ペース分析
              <span className="text-xs font-normal text-slate-500">
                使える日数: {usableDays(ym)}日 / 今から残り: {Math.max(0, usableDays(ym) - new Date().getDate())}日
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1 text-xs text-slate-500 mb-2 px-1">
              <span>KPI</span>
              <span className="text-center">予算 / 当日累積目標</span>
              <span className="text-center">今から必要な日当たり</span>
            </div>
            <div className="space-y-1.5">
              {KPI_SUMMARY.filter(({ key }) => budgets[key] > 0).map(({ key, label, color }) => {
                const val = totals[key] || 0
                const budget = budgets[key]
                const cumTarget = cumulativeBudgetTarget(budget, ym)
                const reqDaily = requiredDailyFromNow(budget, val, ym)
                const isOnTrack = val >= cumTarget
                const isComplete = val >= budget

                return (
                  <div key={key} className="flex items-center gap-2 py-1 border-b border-slate-800/50">
                    <span className="w-24 text-xs shrink-0" style={{ color }}>{label}</span>
                    <div className="flex-1 flex items-center gap-1.5">
                      {/* 現在値 / 予算 */}
                      <span className="text-slate-200 font-semibold">{val}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-amber-400">{budget}</span>
                      <span className="text-slate-600 text-[10px]">（累積目標 {cumTarget}）</span>
                      {isComplete ? (
                        <Badge className="text-[10px] bg-green-900/50 text-green-400 border-green-700 ml-auto">✓ 達成</Badge>
                      ) : isOnTrack ? (
                        <Badge className="text-[10px] bg-blue-900/50 text-blue-400 border-blue-700 ml-auto">順調</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-red-900/50 text-red-400 border-red-700 ml-auto">
                          -{Math.round((cumTarget - val) * 10) / 10} 遅れ
                        </Badge>
                      )}
                    </div>
                    {/* 今から必要な日当たり */}
                    <div className="w-20 text-right shrink-0">
                      {val >= budget ? (
                        <span className="text-green-400 font-bold">完了</span>
                      ) : reqDaily > 0 ? (
                        <span className={`font-bold ${reqDaily > dailyBudgetRate(budget, ym) * 1.5 ? 'text-red-400' : reqDaily > dailyBudgetRate(budget, ym) ? 'text-amber-400' : 'text-slate-300'}`}>
                          {reqDaily}/日
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 確認数字（自動計算） */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">確認数字（自動計算）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {[
              { label: '無着地率',      value: pct(totals.muchaku,                              totals.apo_exec),  color: '#f87171' },
              { label: 'ターゲット到達', value: pct((totals.apo_exec||0)-(totals.ng||0),         totals.apo_exec),  color: '#22c55e' },
              { label: 'NG率',          value: pct(totals.ng,                                   totals.apo_exec),  color: '#fb923c' },
              { label: 'テスクロ率',    value: pct(totals.test_close,                           totals.apo_exec),  color: '#a78bfa' },
              { label: 'オファー率',    value: pct(totals.offer,                                totals.apo_exec),  color: '#f59e0b' },
              { label: '動員獲得率',    value: pct(totals.doin_get,                             totals.apo_exec),  color: '#60a5fa' },
              { label: '動員実施率',    value: pct(totals.doin_exec,                            totals.apo_exec),  color: '#818cf8' },
              { label: '成約率',        value: pct(totals.seiyaku,                              totals.doin_exec), color: '#34d399' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-500 mb-1 leading-tight">{label}</div>
                <div className="text-xl font-bold" style={{ color }}>{value}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* グラフと残案件 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* 週別推移チャート */}
        <Card className="xl:col-span-2 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              週別推移（全KPI）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={weeklyData}>
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {KPI_SUMMARY.map(({ key, label, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={label}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: color }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 残案件 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                残案件 ({activeCases.length}件)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* 追加フォーム */}
            <div className="space-y-1">
              {/* 1行目: 顧客名 + 次回アクション */}
              <div className="flex items-center gap-1.5">
                <Input
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  placeholder="顧客名"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500 flex-1 min-w-0"
                />
                <select
                  value={newNextAction}
                  onChange={e => setNewNextAction(e.target.value)}
                  className="h-7 text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded px-1 shrink-0"
                >
                  {NEXT_ACTION_OPTIONS.map((s, i) => (
                    <option key={i} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {/* 2行目: 日付 + クローザー + 追加ボタン */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={newNextActionDate}
                  onChange={e => setNewNextActionDate(e.target.value)}
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 w-32 shrink-0"
                />
                <Input
                  value={newCloserName}
                  onChange={e => setNewCloserName(e.target.value)}
                  placeholder="クローザー"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500 flex-1 min-w-0"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-indigo-400 hover:text-indigo-300 shrink-0"
                  onClick={handleAddCase}
                  disabled={!newCustomerName.trim() || addCaseMutation.isPending}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* 案件リスト */}
            <div className="overflow-auto max-h-48 space-y-1">
              {activeCases.length === 0 ? (
                <p className="text-slate-500 text-xs">残案件なし</p>
              ) : (
                activeCases.map((c: StCase) => (
                  <div key={c.id} className="flex items-center gap-1.5 text-xs py-0.5 border-b border-slate-800/50">
                    <span className="text-slate-200 font-medium truncate w-20 shrink-0">{c.customer_name}</span>
                    <Badge variant="outline" className="text-[10px] border-slate-700 text-indigo-400 shrink-0 px-1">
                      {c.next_action}
                    </Badge>
                    {c.cu_off_care && (
                      <span className="text-amber-400 shrink-0 text-[10px]">{c.cu_off_care}</span>
                    )}
                    {c.closer_name && (
                      <span className="text-slate-500 shrink-0 text-[10px]">{c.closer_name}</span>
                    )}
                    {c.next_action_date && (
                      <span className="text-cyan-400 shrink-0 text-[10px] ml-auto">{c.next_action_date}</span>
                    )}
                    <button
                      onClick={() => deleteCaseMutation.mutate(c.id)}
                      className="text-slate-600 hover:text-red-400 shrink-0 ml-0.5"
                      disabled={deleteCaseMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 無着地理由・NG理由ランキング */}
      {(muchaReasons.length > 0 || ngReasons.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {muchaReasons.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <span className="text-red-400">⚠</span>
                  無着地理由ランキング（月計: {totals.muchaku || 0}件）
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {muchaReasons.map(([reason, count], i) => {
                  const maxCnt = muchaReasons[0][1]
                  return (
                    <div key={reason} className="flex items-center gap-2">
                      <span className={`text-xs w-4 font-bold ${i === 0 ? 'text-red-400' : 'text-slate-500'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-slate-300 truncate">{reason}</span>
                          <span className="text-xs font-bold text-slate-200 ml-2 shrink-0">{count}件</span>
                        </div>
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${(count / maxCnt) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
          {ngReasons.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <span className="text-orange-400">✕</span>
                  NG理由ランキング（月計: {totals.ng || 0}件）
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ngReasons.map(([reason, count], i) => {
                  const maxCnt = ngReasons[0][1]
                  return (
                    <div key={reason} className="flex items-center gap-2">
                      <span className={`text-xs w-4 font-bold ${i === 0 ? 'text-orange-400' : 'text-slate-500'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-slate-300 truncate">{reason}</span>
                          <span className="text-xs font-bold text-slate-200 ml-2 shrink-0">{count}件</span>
                        </div>
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${(count / maxCnt) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// KPIカードコンポーネント
function KpiCard({
  label, value, goal, budget, rate, color, daily, needPerDay, important, cumulativeTarget, requiredDailyBudget
}: {
  label: string, value: number, goal: number, budget: number, rate: number,
  color: string, daily: string, needPerDay: number, important: boolean,
  cumulativeTarget: number, requiredDailyBudget: number
}) {
  const progressColor = rate >= 100 ? 'bg-green-500' : rate >= 70 ? 'bg-yellow-400' : 'bg-red-500'
  const hasBudget = budget > 0
  const paceBase = hasBudget ? budget : goal
  const budgetRate = hasBudget ? Math.round((value / budget) * 100) : 0
  // ペース判定（今日の累積目標に対して進んでいるか）
  const isOnPace = cumulativeTarget > 0 ? value >= cumulativeTarget : true
  const paceGap = cumulativeTarget > 0 ? Math.round(value - cumulativeTarget) : 0
  // ペースバー（今日の累積目標 / 月間目標ベース）
  const pacePct = paceBase > 0 ? Math.min(100, Math.round((cumulativeTarget / paceBase) * 100)) : 0

  return (
    <Card className={`bg-slate-900 border-slate-800 ${important ? 'ring-1 ring-indigo-500/30' : ''}`}>
      <CardContent className="p-3">
        <div className="text-xs text-slate-500 mb-1 truncate">{label}</div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          <div className="text-right">
            {hasBudget ? (
              <>
                <div className="text-xs text-amber-400">予算{budget}</div>
                <div className="text-xs text-slate-500">目標{goal}</div>
              </>
            ) : (
              <span className="text-xs text-slate-500">/{goal}</span>
            )}
          </div>
        </div>
        {/* 達成率バー（目標ベース） */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
          <div
            className={`h-full rounded-full transition-all ${progressColor}`}
            style={{ width: `${Math.min(100, rate)}%` }}
          />
        </div>
        {/* ペースライン（今日時点の累積目標位置を示すマーカー） */}
        {cumulativeTarget > 0 && paceBase > 0 && (
          <div className="relative w-full h-1 bg-slate-800/60 rounded-full overflow-hidden mb-1">
            {/* 実績バー */}
            <div
              className="h-full rounded-full transition-all bg-indigo-500/50"
              style={{ width: `${Math.min(100, Math.round((value / paceBase) * 100))}%` }}
            />
            {/* 今日のペース目標マーカー */}
            <div
              className="absolute top-0 w-0.5 h-full bg-yellow-400"
              style={{ left: `${pacePct}%` }}
            />
          </div>
        )}
        {/* 予算バー */}
        {hasBudget && (
          <div className="w-full h-1 bg-slate-800/60 rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-amber-500/60 transition-all"
              style={{ width: `${Math.min(100, budgetRate)}%` }}
            />
          </div>
        )}
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">{rate}%</span>
            {hasBudget ? (
              <span className="text-amber-500 text-[10px]">予算{budgetRate}%</span>
            ) : needPerDay > 0 ? (
              <span className="text-amber-400">{needPerDay}/日</span>
            ) : null}
          </div>
          {/* ペース表示（常時・予算あり/なし問わず） */}
          {cumulativeTarget > 0 && (
            <div className="flex justify-between items-center text-[10px] mt-0.5 pt-0.5 border-t border-slate-800">
              <span className="text-slate-500">
                今日目標<span className={`ml-1 font-bold ${isOnPace ? 'text-cyan-400' : 'text-yellow-400'}`}>{cumulativeTarget}</span>
              </span>
              {value >= paceBase ? (
                <span className="text-green-400 font-bold">✓ 達成</span>
              ) : isOnPace ? (
                <span className="text-cyan-400">+{paceGap} 順調</span>
              ) : (
                <span className="text-red-400 font-bold">{paceGap} 遅れ</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 週別チャートデータ構築（KPI_SUMMARY全項目）
function buildWeeklyChartData(metrics: DailyMetrics[]) {
  const weekMap = new Map<string, Record<string, number>>()

  metrics.forEach(m => {
    const d = new Date(m.date)
    const dayOfWeek = d.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(d)
    monday.setDate(d.getDate() + diff)
    const key = `${monday.getMonth() + 1}/${monday.getDate()}週`

    const existing = weekMap.get(key) || {}
    KPI_SUMMARY.forEach(({ key: field }) => {
      existing[field] = (existing[field] || 0) + ((m[field as keyof DailyMetrics] as number) || 0)
    })
    weekMap.set(key, existing)
  })

  return Array.from(weekMap.entries()).map(([week, vals]) => ({ week, ...vals }))
}
