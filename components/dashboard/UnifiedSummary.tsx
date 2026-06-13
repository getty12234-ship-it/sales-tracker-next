'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getSettings, getInstagramAccounts, getInstagramMonthlyMetrics, getInstagramMetricsByAccounts, upsertMonthlyGoal } from '@/lib/queries'
import { getMonthDays, getWeekDays, addWeeks, pct, elapsedUsableDays, remainingUsableDays, cumulativeBudgetTarget, requiredDailyFromNow } from '@/lib/date-utils'
import { METRIC_FIELDS, IG_METRIC_FIELDS } from '@/lib/constants'
import type { DailyMetrics, InstagramMetrics } from '@/lib/supabase'
import { extractBudgets } from '@/lib/supabase'
import { resolveCwGoal, resolveIgGoalCombined, resolveIgBudgetCombined } from '@/lib/goals'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { syncEvents } from './Header'
import { Layers, Calendar } from 'lucide-react'
import { MultiPaceCard, buildPaceWindows } from './PaceBar'

// ===== 合算定義（その他⇄インスタの対応キー。インスタに対応がないものは other のみ） =====
const UNIFIED_KPIS = [
  { key: 'apo_get',     igKey: 'ig_apo_get',   label: 'アポ獲得',     color: '#3b82f6', important: false, pace: true },
  { key: 'apo_exec',    igKey: 'ig_apo_exec',  label: 'アポ実施',     color: '#06b6d4', important: true,  pace: true },
  { key: 'doin_get',    igKey: 'ig_doin_get',  label: '動員獲得',     color: '#a855f7', important: false, pace: true },
  { key: 'doin_exec',   igKey: 'ig_doin_exec', label: '動員実施',     color: '#8b5cf6', important: true,  pace: true },
  { key: 'mendan_get',  igKey: null,           label: '面談獲得',     color: '#818cf8', important: false, pace: false },
  { key: 'mendan_exec', igKey: null,           label: '面談実施',     color: '#6366f1', important: true,  pace: true },
  { key: 'seiyaku',     igKey: 'ig_seiyaku',   label: '成約',         color: '#22c55e', important: true,  pace: true },
  { key: 'cooling_off', igKey: null,           label: 'クーリングOFF', color: '#94a3b8', important: false, pace: false },
] as const

export function UnifiedSummary() {
  const { currentMember, currentYearMonth: ym, currentWeekStart } = useAppState()
  const monthDays = getMonthDays(ym)
  const weekStart = currentWeekStart
  const lastWeekStart = addWeeks(weekStart, -1)
  const weekDays = getWeekDays(weekStart)
  const lastWeekDays = getWeekDays(lastWeekStart)

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

  // 今週・先週（3期間バー用）
  const accountIds = accounts.map(a => a.id)
  const { data: otherWeek = [] } = useQuery({
    queryKey: ['daily_metrics_week', currentMember?.id, weekStart],
    queryFn: () => getDailyMetrics(currentMember!.id, weekDays[0], weekDays[6]),
    enabled: !!currentMember,
  })
  const { data: otherLastWeek = [] } = useQuery({
    queryKey: ['daily_metrics_week', currentMember?.id, lastWeekStart],
    queryFn: () => getDailyMetrics(currentMember!.id, lastWeekDays[0], lastWeekDays[6]),
    enabled: !!currentMember,
  })
  const { data: igWeek = [] } = useQuery({
    queryKey: ['ig_metrics_member_week', accountIds.join(','), weekStart],
    queryFn: () => getInstagramMetricsByAccounts(accountIds, weekDays[0], weekDays[6]),
    enabled: accountIds.length > 0,
  })
  const { data: igLastWeek = [] } = useQuery({
    queryKey: ['ig_metrics_member_week', accountIds.join(','), lastWeekStart],
    queryFn: () => getInstagramMetricsByAccounts(accountIds, lastWeekDays[0], lastWeekDays[6]),
    enabled: accountIds.length > 0,
  })

  const queryClient = useQueryClient()
  // 今月の目標・予算メモ（自由記述）
  const savedMonthlyGoal = ((settings?.monthly_goals as Record<string, string>) || {})[ym] || ''
  const [goalText, setGoalText] = useState('')
  const goalTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { setGoalText(savedMonthlyGoal) }, [savedMonthlyGoal, ym])
  const { mutate: saveGoal } = useMutation({
    mutationFn: (text: string) => upsertMonthlyGoal(currentMember!.id, ym, text),
    onMutate: () => syncEvents.emit('saving'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', currentMember?.id] })
      syncEvents.emit('saved'); setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })
  const handleGoalChange = (text: string) => {
    setGoalText(text)
    if (goalTimer.current) clearTimeout(goalTimer.current)
    goalTimer.current = setTimeout(() => saveGoal(text), 700)
  }

  if (!currentMember) {
    return <div className="flex items-center justify-center h-64 text-slate-500">メンバーを選択してください</div>
  }

  // その他チャネルの合計（月／今週／先週）
  const sumOther = (arr: DailyMetrics[], key: string) =>
    arr.reduce((s, m) => s + ((m[key as keyof DailyMetrics] as number) || 0), 0)
  const otherTotals: Record<string, number> = {}
  const otherWeekTotals: Record<string, number> = {}
  const otherLastWeekTotals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    otherTotals[key] = sumOther(otherMetrics, key)
    otherWeekTotals[key] = sumOther(otherWeek, key)
    otherLastWeekTotals[key] = sumOther(otherLastWeek, key)
  })
  // インスタの合計（複数アカウント横断・フロー値のみ・月／今週／先週）
  const sumIg = (arr: InstagramMetrics[], key: string) =>
    arr.reduce((s, m) => s + ((m[key as keyof InstagramMetrics] as number) || 0), 0)
  const igTotals: Record<string, number> = {}
  const igWeekTotals: Record<string, number> = {}
  const igLastWeekTotals: Record<string, number> = {}
  IG_METRIC_FIELDS.forEach(({ key, stock }) => {
    if (stock) return
    igTotals[key] = sumIg(igMonthly, key)
    igWeekTotals[key] = sumIg(igWeek, key)
    igLastWeekTotals[key] = sumIg(igLastWeek, key)
  })

  // 目標・予算（解決ロジックは lib/goals.ts に集約＝全ビューで同一・DEFAULT焼き込みを混ぜない）
  const rawGoals = (settings?.goals as Record<string, number>) || {}
  const budgets = extractBudgets(rawGoals)
  const cwGoal = (key: string): number => resolveCwGoal(rawGoals, budgets, key)
  // インスタ目標/予算（合算ビュー）：設定がある場合のみ採用。未設定は0（合算を勝手に膨らませない）
  const igGoal = (key: string): number => resolveIgGoalCombined(rawGoals, key)
  const igBudget = (key: string): number => resolveIgBudgetCombined(rawGoals, key)

  // 経過/残りは usableDays(月末-3) 暦日基準で統一（営業日と暦日の混在を解消・合計=usableDays）
  const remaining = remainingUsableDays(ym)
  const passed = elapsedUsableDays(ym)

  // 各KPIの合算行を計算
  const rows = UNIFIED_KPIS.map(k => {
    const otherVal = otherTotals[k.key] || 0
    const igVal = k.igKey ? (igTotals[k.igKey] || 0) : 0
    const total = otherVal + igVal
    const weekVal = (otherWeekTotals[k.key] || 0) + (k.igKey ? (igWeekTotals[k.igKey] || 0) : 0)
    const lastWeekVal = (otherLastWeekTotals[k.key] || 0) + (k.igKey ? (igLastWeekTotals[k.igKey] || 0) : 0)
    const cwBudgetVal = budgets[k.key] || 0
    const igBudgetVal = k.igKey ? igBudget(k.igKey) : 0
    const budget = cwBudgetVal + igBudgetVal
    const goal = cwGoal(k.key) + (k.igKey ? igGoal(k.igKey) : 0)
    const paceBase = budget > 0 ? budget : goal
    const cumTarget = paceBase > 0 ? Math.round(cumulativeBudgetTarget(paceBase, ym) * 10) / 10 : 0
    const budgetPace = budget > 0 ? cumulativeBudgetTarget(budget, ym) : 0
    const goalPace = goal > 0 ? cumulativeBudgetTarget(goal, ym) : 0
    const reqDaily = paceBase > 0 ? requiredDailyFromNow(paceBase, total, ym) : 0
    const rate = pct(total, goal)
    return { ...k, otherVal, igVal, total, weekVal, lastWeekVal, cwBudgetVal, igBudgetVal, budget, goal, paceBase, cumTarget, budgetPace, goalPace, reqDaily, rate }
  })

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

      {/* 今月の目標・予算メモ（自由記述） */}
      <Card className="bg-slate-900 border-slate-800 border-l-2 border-l-indigo-500/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            🎯 今月の目標・予算メモ
            <span className="text-xs font-normal text-slate-500">{ym.replace('-', '年')}月・自由記述</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-24 resize-y leading-relaxed"
            value={goalText}
            onChange={e => handleGoalChange(e.target.value)}
            placeholder={'今月の目標・予算・狙いを自由に記入...\n例）成約予算3件／アポ獲得50件・実施30件\n　　売上目標◯◯円。今月のテーマは「テスクロ完走率UP」'}
          />
        </CardContent>
      </Card>

      {/* 今月の予算（その他＋インスタ合算） */}
      <Card className="bg-slate-900 border-slate-800 border-l-2 border-l-amber-500/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            💰 今月の予算（その他＋インスタ合算）
            <span className="text-[11px] font-normal text-slate-500">{ym.replace('-', '年')}月・チャネル別と合計</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">KPI</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">その他予算</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap text-pink-400">インスタ予算</th>
                <th className="text-right px-4 py-2 font-semibold whitespace-nowrap text-amber-300">今月の予算<br/>（合計）</th>
                <th className="text-right px-4 py-2 font-semibold whitespace-nowrap text-indigo-300">目標（合計）</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(r => r.budget > 0 || r.goal > 0).map(r => (
                <tr key={r.key} className={`border-b border-slate-800/40 hover:bg-slate-800/20 ${r.important ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap" style={{ color: r.color }}>{r.important && '★ '}{r.label}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">{r.cwBudgetVal || <span className="text-slate-700">—</span>}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">{r.igKey ? (r.igBudgetVal || <span className="text-slate-700">—</span>) : <span className="text-slate-700">—</span>}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-amber-300">{r.budget || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-2 text-right font-mono text-indigo-200">{r.goal || <span className="text-slate-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-slate-600 leading-relaxed">
            「今月の予算（合計）」＝その他の獲得方法の予算＋インスタの予算。設定ページで各チャネル別に設定できます（未設定は—）。
          </div>
        </CardContent>
      </Card>

      {/* ① 今月の現状＆ペース（合算）— その他の獲得方法と同じバー表示 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            🎯 今月の現状＆ペース（その他＋インスタの合算）
            <span className="text-[11px] font-normal text-slate-500">実績フィルと、今日ここまで到達すべき予算/目標ラインの位置で進捗を見る</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.filter(r => r.pace).map(r => {
              const done = r.paceBase > 0 && r.total >= r.paceBase
              const windows = buildPaceWindows({
                monthVal: r.total, weekVal: r.weekVal, lastWeekVal: r.lastWeekVal,
                monthlyBudget: r.budget, monthlyGoal: r.goal,
                ym, weekStart, lastWeekStart,
              })
              return (
                <MultiPaceCard
                  key={r.key}
                  label={r.label}
                  color={r.color}
                  important={r.important}
                  windows={windows}
                  footer={
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">月間 今から必要</span>
                      {done ? <span className="text-green-400 font-bold">完了</span>
                        : r.reqDaily > 0 ? <span className="text-cyan-300 font-bold">{r.reqDaily}<span className="text-slate-500"> 本/日</span></span>
                        : <span className="text-slate-600">—</span>}
                    </div>
                  }
                />
              )
            })}
          </div>
          <div className="mt-2 text-[10px] text-slate-600 leading-relaxed">
            各KPIを「月間／今週／先週」で表示。🟡予算ライン・🩵目標ラインは各期間で“今ここまで到達しておきたい”位置（先週は週フルの目安）。「月間 今から必要」＝残り日数で月予算に届かせるのに毎日必要な本数。
          </div>
        </CardContent>
      </Card>

      {/* ② 全KPI一覧（その他 / インスタ / 合算 × 予算・目標・達成率） */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            📊 全KPI一覧（その他 / インスタ / 合算）
            <span className="text-[11px] font-normal text-slate-500">チャネル別と合算の実績・予算・目標</span>
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
              {rows.map(r => (
                <tr key={r.key} className={`border-b border-slate-800/40 hover:bg-slate-800/20 ${r.important ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2 font-semibold" style={{ color: r.color }}>{r.important && '★ '}{r.label}</td>
                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{r.otherVal}</td>
                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{r.igKey ? r.igVal : <span className="text-slate-700">—</span>}</td>
                  <td className="px-3 py-2 text-right font-bold font-mono" style={{ color: r.color }}>{r.total}</td>
                  <td className="px-3 py-2 text-right text-amber-300 font-mono">{r.budget || ''}</td>
                  <td className="px-3 py-2 text-right text-indigo-300 font-mono">{r.goal || ''}</td>
                  <td className={`px-3 py-2 text-right font-bold ${r.rate >= 100 ? 'text-green-400' : r.rate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{r.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-slate-600">合算＝その他＋インスタ。面談獲得・面談実施・クーリングOFFはインスタ対象外。予算/目標は設定ページでチャネル別に設定（未設定のインスタは0）。</div>
        </CardContent>
      </Card>
    </div>
  )
}
