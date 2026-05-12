'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getSettings, getActiveCases, getCancels } from '@/lib/queries'
import { getMonthDays, currentYearMonth, pct, remainingWorkdays, passedWorkdays, totalWorkdays } from '@/lib/date-utils'
import { KPI_SUMMARY, DEFAULT_GOALS, METRIC_FIELDS } from '@/lib/constants'
import type { DailyMetrics } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Target, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export function SummaryDashboard() {
  const { currentMember, currentYearMonth: ym } = useAppState()
  const monthDays = getMonthDays(ym)

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
    queryKey: ['active_cases'],
    queryFn: getActiveCases,
  })

  const { data: cancels = [] } = useQuery({
    queryKey: ['cancels'],
    queryFn: getCancels,
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

  const goals = (settings?.goals as Record<string, number>) || DEFAULT_GOALS
  const remaining = remainingWorkdays(ym)
  const passed = passedWorkdays(ym)
  const total = totalWorkdays(ym)

  // 週別チャートデータ
  const weeklyData = buildWeeklyChartData(metrics)

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">
          {ym.replace('-', '年')}月 サマリー
        </h1>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          残り営業日: <span className="text-slate-200 font-semibold">{remaining}日</span>
          <span className="text-slate-600">/ {total}日</span>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {KPI_SUMMARY.map(({ key, label, color, important }) => {
          const val = totals[key] || 0
          const goal = goals[key] || 0
          const rate = pct(val, goal)
          const daily = passed > 0 ? (val / passed).toFixed(1) : '0'
          const needPerDay = remaining > 0 ? Math.ceil(Math.max(0, goal - val) / remaining) : 0

          return (
            <KpiCard
              key={key}
              label={label}
              value={val}
              goal={goal}
              rate={rate}
              color={color}
              daily={daily}
              needPerDay={needPerDay}
              important={important}
            />
          )
        })}
      </div>

      {/* グラフと残案件 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* 週別推移チャート */}
        <Card className="xl:col-span-2 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              週別推移（成約・動員実施・アポ実施）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} barGap={2}>
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="seiyaku" name="成約" fill="#22c55e" radius={[3,3,0,0]} />
                <Bar dataKey="doin_exec" name="動員実施" fill="#8b5cf6" radius={[3,3,0,0]} />
                <Bar dataKey="apo_exec" name="アポ実施" fill="#06b6d4" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 残案件 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              残案件 ({activeCases.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto max-h-52">
            {activeCases.length === 0 ? (
              <p className="text-slate-500 text-xs">残案件なし</p>
            ) : (
              <div className="space-y-1.5">
                {activeCases.slice(0, 10).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-slate-300 truncate">{c.customer?.name}</span>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 shrink-0">
                      {c.status}
                    </Badge>
                  </div>
                ))}
                {activeCases.length > 10 && (
                  <p className="text-slate-500 text-xs">+ {activeCases.length - 10}件</p>
                )}
              </div>
            )}
            {cancels.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-1.5">動員CXL ({cancels.length}件)</p>
                {cancels.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="text-xs text-slate-400 truncate">
                    {c.customer?.name}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// KPIカードコンポーネント
function KpiCard({
  label, value, goal, rate, color, daily, needPerDay, important
}: {
  label: string, value: number, goal: number, rate: number,
  color: string, daily: string, needPerDay: number, important: boolean
}) {
  const progressColor = rate >= 100 ? 'bg-green-500' : rate >= 70 ? 'bg-yellow-400' : 'bg-red-500'

  return (
    <Card className={`bg-slate-900 border-slate-800 ${important ? 'ring-1 ring-indigo-500/30' : ''}`}>
      <CardContent className="p-3">
        <div className="text-xs text-slate-500 mb-1 truncate">{label}</div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          <span className="text-xs text-slate-500">/{goal}</span>
        </div>
        {/* プログレス */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full transition-all ${progressColor}`}
            style={{ width: `${Math.min(100, rate)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">{rate}%</span>
          {needPerDay > 0 && (
            <span className="text-amber-400">{needPerDay}/日</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 週別チャートデータ構築
function buildWeeklyChartData(metrics: DailyMetrics[]) {
  const weekMap = new Map<string, { seiyaku: number; doin_exec: number; apo_exec: number }>()

  metrics.forEach(m => {
    const d = new Date(m.date)
    const dayOfWeek = d.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(d)
    monday.setDate(d.getDate() + diff)
    const key = `${monday.getMonth() + 1}/${monday.getDate()}週`

    const existing = weekMap.get(key) || { seiyaku: 0, doin_exec: 0, apo_exec: 0 }
    weekMap.set(key, {
      seiyaku: existing.seiyaku + (m.seiyaku || 0),
      doin_exec: existing.doin_exec + (m.doin_exec || 0),
      apo_exec: existing.apo_exec + (m.apo_exec || 0),
    })
  })

  return Array.from(weekMap.entries()).map(([week, vals]) => ({ week, ...vals }))
}
