'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getSettings, getInstagramAccounts, getInstagramMonthlyMetrics } from '@/lib/queries'
import { getMonthDays, pct, remainingWorkdays, passedWorkdays, cumulativeBudgetTarget, requiredDailyFromNow } from '@/lib/date-utils'
import { DEFAULT_GOALS, METRIC_FIELDS, IG_METRIC_FIELDS, IG_DEFAULT_GOALS } from '@/lib/constants'
import type { DailyMetrics, InstagramMetrics } from '@/lib/supabase'
import { extractBudgets } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Layers, Camera, TrendingUp, Calendar } from 'lucide-react'

// ===== 合算定義 =====
// その他とインスタで対応するキーをペアリング。インスタに対応キーがないものは other のみ集計。
const UNIFIED_KPIS = [
  { key: 'apo_get',     igKey: 'ig_apo_get',   label: 'アポ獲得',    color: '#3b82f6', important: false },
  { key: 'apo_exec',    igKey: 'ig_apo_exec',  label: 'アポ実施',    color: '#06b6d4', important: false },
  { key: 'doin_get',    igKey: 'ig_doin_get',  label: '動員獲得',    color: '#a855f7', important: false },
  { key: 'doin_exec',   igKey: 'ig_doin_exec', label: '動員実施',    color: '#8b5cf6', important: true  },
  { key: 'mendan_get',  igKey: null,           label: '面談獲得',    color: '#818cf8', important: false },
  { key: 'mendan_exec', igKey: null,           label: '面談実施',    color: '#6366f1', important: true  },
  { key: 'seiyaku',     igKey: 'ig_seiyaku',   label: '成約',        color: '#22c55e', important: true  },
  { key: 'cooling_off', igKey: null,           label: 'クーリングOFF', color: '#94a3b8', important: false },
] as const

export function UnifiedSummary() {
  const { currentMember, currentYearMonth: ym } = useAppState()
  const monthDays = getMonthDays(ym)

  const { data: otherMetrics = [] } = useQuery({
    queryKey: ['daily_metrics', currentMember?.id, ym],
    queryFn: () => getDailyMetrics(currentMember!.id, monthDays[0], monthDays[monthDays.length - 1]),
    enabled: !!currentMember,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings', currentMember?.id],
    queryFn: () => getSettings(currentMember!.id),
    enabled: !!currentMember,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['ig_accounts', currentMember?.id],
    queryFn: () => getInstagramAccounts(currentMember?.id),
    enabled: !!currentMember,
  })

  const { data: igMonthly = [] } = useQuery({
    queryKey: ['ig_monthly_all', accounts.map(a => a.id).join(','), ym],
    queryFn: async () => {
      const results = await Promise.all(accounts.map(a => getInstagramMonthlyMetrics(a.id, ym)))
      return results.flat()
    },
    enabled: accounts.length > 0,
  })

  if (!currentMember) {
    return <div className="flex items-center justify-center h-64 text-slate-500">メンバーを選択してください</div>
  }

  // ===== その他チャネルの月次合計 =====
  const otherTotals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    otherTotals[key] = otherMetrics.reduce((s, m) => s + ((m[key as keyof DailyMetrics] as number) || 0), 0)
  })

  // ===== インスタの月次合計（複数アカウント横断） =====
  const igTotals: Record<string, number> = {}
  IG_METRIC_FIELDS.forEach(({ key, stock }) => {
    if (stock) return // ストック値は合算しない
    igTotals[key] = igMonthly.reduce((s, m) => s + ((m[key as keyof InstagramMetrics] as number) || 0), 0)
  })

  // ===== 目標・予算 =====
  const rawGoals = (settings?.goals as Record<string, number>) || {}
  const goals = { ...DEFAULT_GOALS, ...rawGoals }
  const budgets = extractBudgets(rawGoals)
  // インスタ目標：goalsに ig_xxx があればそれ、なければ IG_DEFAULT_GOALS × アカウント数
  const accountCount = accounts.length || 1
  const igGoal = (key: string): number => {
    const customKey = `ig_${key}`
    if (rawGoals[customKey] !== undefined) return rawGoals[customKey]
    return (IG_DEFAULT_GOALS[key] || 0) * accountCount
  }
  const igBudget = (key: string): number => {
    const customKey = `b_ig_${key}`
    if (rawGoals[customKey] !== undefined) return rawGoals[customKey]
    return igGoal(key) // 予算未設定は目標と同値
  }

  const remaining = remainingWorkdays(ym)
  const passed = passedWorkdays(ym)

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          統合サマリー
          <span className="text-xs font-normal text-slate-500">{ym.replace('-', '年')}月</span>
        </h1>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          経過 <span className="text-slate-200 font-semibold">{passed}</span>日 / 残り <span className="text-slate-200 font-semibold">{remaining}</span>日
        </div>
      </div>

      {/* 説明 */}
      <Card className="bg-slate-900 border-slate-800 border-l-2 border-l-indigo-500/60">
        <CardContent className="py-2.5 px-4 text-[11px] text-slate-400 leading-relaxed">
          🌐 「その他の獲得方法」（CW/LINE/他）＋「インスタ」の月次実績を合算したサマリー。
          合算対象は <span className="text-slate-200 font-semibold">アポ獲得・アポ実施・動員獲得・動員実施・成約</span>。
          面談獲得・面談実施・クーリングOFFはその他のみ、投稿数は両チャネル別で表示。
        </CardContent>
      </Card>

      {/* 主要KPIの着地（合算）— 重要KPIだけに絞ってカード表示。全KPIは下の表で。 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            🎯 主要KPIの着地（合算）
            <span className="text-[11px] font-normal text-slate-500">アポ実施・動員実施・面談実施・成約／全KPIは下の表</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {UNIFIED_KPIS.filter(k => k.important).map(({ key, igKey, label, color, important }) => {
              const otherVal = otherTotals[key] || 0
              const igVal = igKey ? (igTotals[igKey] || 0) : 0
              const totalVal = otherVal + igVal
              const otherGoal = goals[key] || 0
              const igGoalVal = igKey ? igGoal(igKey) : 0
              const totalGoal = otherGoal + igGoalVal
              const otherBudget = budgets[key] || 0
              const igBudgetVal = igKey ? igBudget(igKey) : 0
              const totalBudget = otherBudget + igBudgetVal
              const rate = pct(totalVal, totalGoal)
              const paceBase = totalBudget > 0 ? totalBudget : totalGoal
              const cumTarget = paceBase > 0 ? cumulativeBudgetTarget(paceBase, ym) : 0
              const reqDaily = paceBase > 0 ? requiredDailyFromNow(paceBase, totalVal, ym) : 0
              const needPerDay = remaining > 0 ? Math.ceil(Math.max(0, totalGoal - totalVal) / remaining) : 0
              return (
                <UnifiedKpiCard
                  key={key}
                  label={label}
                  totalVal={totalVal}
                  otherVal={otherVal}
                  igVal={igVal}
                  hasIg={igKey !== null}
                  goal={totalGoal}
                  budget={totalBudget}
                  rate={rate}
                  color={color}
                  important={important}
                  cumulativeTarget={cumTarget}
                  requiredDailyBudget={reqDaily}
                  needPerDay={needPerDay}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 投稿数：チャネル別表示 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            📝 投稿数（チャネル別）
            <span className="text-[11px] font-normal text-slate-500">フィールドが別のため合算しません</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChannelStatCard
              icon={<TrendingUp className="w-4 h-4 text-amber-400" />}
              label="その他の投稿（post）"
              value={otherTotals['post'] || 0}
              goal={goals['post'] || 0}
              color="#ec4899"
            />
            <ChannelStatCard
              icon={<Camera className="w-4 h-4 text-pink-400" />}
              label={`インスタ投稿数（${accounts.length}アカウント合計）`}
              value={igTotals['posts'] || 0}
              goal={igGoal('posts')}
              color="#a78bfa"
            />
          </div>
        </CardContent>
      </Card>

      {/* チャネル別内訳テーブル */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            📊 月次 全KPI一覧（その他 / インスタ / 合算）
            <span className="text-[11px] font-normal text-slate-500">実績と予算・目標を一覧で</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-2 text-slate-500 font-semibold">KPI</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">その他</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">インスタ</th>
                <th className="text-right px-3 py-2 text-pink-400 font-semibold">合算</th>
                <th className="text-right px-3 py-2 text-amber-400 font-semibold">予算</th>
                <th className="text-right px-3 py-2 text-indigo-400 font-semibold">目標</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">達成率</th>
              </tr>
            </thead>
            <tbody>
              {UNIFIED_KPIS.map(({ key, igKey, label, color, important }) => {
                const otherVal = otherTotals[key] || 0
                const igVal = igKey ? (igTotals[igKey] || 0) : 0
                const total = otherVal + igVal
                const totalGoal = (goals[key] || 0) + (igKey ? igGoal(igKey) : 0)
                const totalBudget = (budgets[key] || 0) + (igKey ? igBudget(igKey) : 0)
                const rate = pct(total, totalGoal)
                return (
                  <tr key={key} className={`border-b border-slate-800/40 hover:bg-slate-800/20 ${important ? 'bg-slate-800/30' : ''}`}>
                    <td className="px-4 py-2 font-semibold" style={{ color }}>{important && '★ '}{label}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{otherVal}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{igKey ? igVal : <span className="text-slate-700">—</span>}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono" style={{ color }}>{total}</td>
                    <td className="px-3 py-2 text-right text-amber-300 font-mono">{totalBudget || ''}</td>
                    <td className="px-3 py-2 text-right text-indigo-300 font-mono">{totalGoal || ''}</td>
                    <td className={`px-3 py-2 text-right font-bold ${rate >= 100 ? 'text-green-400' : rate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{rate}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== KPIカード（合算・内訳付き） =====
function UnifiedKpiCard({
  label, totalVal, otherVal, igVal, hasIg, goal, budget, rate, color, important,
  cumulativeTarget, requiredDailyBudget, needPerDay,
}: {
  label: string
  totalVal: number
  otherVal: number
  igVal: number
  hasIg: boolean
  goal: number
  budget: number
  rate: number
  color: string
  important: boolean
  cumulativeTarget: number
  requiredDailyBudget: number
  needPerDay: number
}) {
  const progressColor = rate >= 100 ? 'bg-green-500' : rate >= 70 ? 'bg-yellow-400' : 'bg-red-500'
  const hasBudget = budget > 0
  const paceBase = hasBudget ? budget : goal
  const budgetRate = hasBudget ? Math.round((totalVal / budget) * 100) : 0
  const isOnPace = cumulativeTarget > 0 ? totalVal >= cumulativeTarget : true
  const paceGap = cumulativeTarget > 0 ? Math.round(totalVal - cumulativeTarget) : 0
  const pacePct = paceBase > 0 ? Math.min(100, Math.round((cumulativeTarget / paceBase) * 100)) : 0

  return (
    <Card className={`bg-slate-950/40 border-slate-800 ${important ? 'ring-1 ring-indigo-500/30' : ''}`}>
      <CardContent className="p-3">
        <div className="text-xs text-slate-500 mb-1 truncate">{label}</div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold" style={{ color }}>{totalVal}</span>
          <div className="text-right">
            {hasBudget ? (
              <>
                <div className="text-[10px] text-amber-400">予算{budget}</div>
                <div className="text-[10px] text-slate-500">目標{goal}</div>
              </>
            ) : (
              <span className="text-xs text-slate-500">/{goal}</span>
            )}
          </div>
        </div>

        {/* 内訳：その他 + インスタ */}
        <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-2">
          <span>その他 <span className="text-slate-200 font-semibold">{otherVal}</span></span>
          {hasIg && (
            <>
              <span className="text-slate-700">+</span>
              <span className="flex items-center gap-0.5"><Camera className="w-2.5 h-2.5 text-pink-400" /><span className="text-slate-200 font-semibold">{igVal}</span></span>
            </>
          )}
          {!hasIg && <span className="text-slate-700">（インスタ対象外）</span>}
        </div>

        {/* ① 達成率バー（目標ベース） */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1" title={`達成率 ${rate}%`}>
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${Math.min(100, rate)}%` }} />
        </div>

        {/* ② ペースライン */}
        {cumulativeTarget > 0 && paceBase > 0 && (
          <div className="relative w-full h-1 bg-slate-800/60 rounded-full overflow-hidden mb-1" title={`今日累積目標 ${cumulativeTarget}`}>
            <div className="h-full rounded-full transition-all bg-indigo-500/50" style={{ width: `${Math.min(100, Math.round((totalVal / paceBase) * 100))}%` }} />
            <div className="absolute top-0 w-0.5 h-full bg-yellow-400" style={{ left: `${pacePct}%` }} />
          </div>
        )}

        {/* ③ 予算バー */}
        {hasBudget && (
          <div className="w-full h-1 bg-slate-800/60 rounded-full overflow-hidden mb-1" title={`予算達成率 ${budgetRate}%`}>
            <div className="h-full rounded-full bg-amber-500/60 transition-all" style={{ width: `${Math.min(100, budgetRate)}%` }} />
          </div>
        )}

        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">{rate}%</span>
            {hasBudget ? (
              <span className="text-amber-500 text-[10px]">予算{budgetRate}%</span>
            ) : needPerDay > 0 ? (
              <span className="text-amber-400 text-[10px]">要{needPerDay}/日</span>
            ) : null}
          </div>
          {cumulativeTarget > 0 && (
            <div className="flex justify-between items-center text-[10px] mt-0.5 pt-0.5 border-t border-slate-800">
              <span className="text-slate-500">
                今日累積: <span className={`font-bold ${isOnPace ? 'text-cyan-400' : 'text-yellow-400'}`}>{cumulativeTarget}</span>
              </span>
              {totalVal >= paceBase ? (
                <span className="text-green-400 font-bold">✓ 達成</span>
              ) : isOnPace ? (
                <span className="text-cyan-400">▲{paceGap} 先行</span>
              ) : (
                <span className="text-red-400 font-bold">▼{Math.abs(paceGap)} 遅れ</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 投稿数表示カード（チャネル別・シンプル）
function ChannelStatCard({
  icon, label, value, goal, color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  goal: number
  color: string
}) {
  const rate = pct(value, goal)
  const progressColor = rate >= 100 ? 'bg-green-500' : rate >= 70 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <Card className="bg-slate-950/40 border-slate-800">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          {icon}<span>{label}</span>
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          <span className="text-xs text-slate-500">/{goal}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${Math.min(100, rate)}%` }} />
        </div>
        <div className="text-xs text-slate-500 mt-1">{rate}%</div>
      </CardContent>
    </Card>
  )
}
