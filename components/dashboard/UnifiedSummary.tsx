'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getSettings, getInstagramAccounts, getInstagramMonthlyMetrics, upsertMonthlyGoal } from '@/lib/queries'
import { getMonthDays, pct, remainingWorkdays, passedWorkdays, cumulativeBudgetTarget, requiredDailyFromNow } from '@/lib/date-utils'
import { DEFAULT_GOALS, METRIC_FIELDS, IG_METRIC_FIELDS } from '@/lib/constants'
import type { DailyMetrics, InstagramMetrics } from '@/lib/supabase'
import { extractBudgets } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { syncEvents } from './Header'
import { Layers, Calendar } from 'lucide-react'

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

  // その他チャネルの月次合計
  const otherTotals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    otherTotals[key] = otherMetrics.reduce((s, m) => s + ((m[key as keyof DailyMetrics] as number) || 0), 0)
  })
  // インスタの月次合計（複数アカウント横断・フロー値のみ）
  const igTotals: Record<string, number> = {}
  IG_METRIC_FIELDS.forEach(({ key, stock }) => {
    if (stock) return
    igTotals[key] = igMonthly.reduce((s, m) => s + ((m[key as keyof InstagramMetrics] as number) || 0), 0)
  })

  // 目標・予算
  const rawGoals = (settings?.goals as Record<string, number>) || {}
  const goals = { ...DEFAULT_GOALS, ...rawGoals }
  const budgets = extractBudgets(rawGoals)
  // インスタ目標/予算：設定がある場合のみ採用。未設定は 0（合算を勝手に膨らませない＝設定した数字がそのまま出る）
  const igGoal = (key: string): number => (rawGoals[`ig_${key}`] !== undefined ? rawGoals[`ig_${key}`] : 0)
  const igBudget = (key: string): number => (rawGoals[`b_ig_${key}`] !== undefined ? rawGoals[`b_ig_${key}`] : 0)

  const remaining = remainingWorkdays(ym)
  const passed = passedWorkdays(ym)

  // 各KPIの合算行を計算
  const rows = UNIFIED_KPIS.map(k => {
    const otherVal = otherTotals[k.key] || 0
    const igVal = k.igKey ? (igTotals[k.igKey] || 0) : 0
    const total = otherVal + igVal
    const budget = (budgets[k.key] || 0) + (k.igKey ? igBudget(k.igKey) : 0)
    const goal = (goals[k.key] || 0) + (k.igKey ? igGoal(k.igKey) : 0)
    const paceBase = budget > 0 ? budget : goal
    const cumTarget = paceBase > 0 ? Math.round(cumulativeBudgetTarget(paceBase, ym) * 10) / 10 : 0
    const reqDaily = paceBase > 0 ? requiredDailyFromNow(paceBase, total, ym) : 0
    const rate = pct(total, goal)
    return { ...k, otherVal, igVal, total, budget, goal, paceBase, cumTarget, reqDaily, rate }
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

      {/* ① 今月の現状＆ペース（合算）— 今この瞬間「1日あたり何本やれば予算に届くか」が分かる表 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            🎯 今月の現状＆ペース（その他＋インスタの合算）
            <span className="text-[11px] font-normal text-slate-500">予算に届くには、今から1日あたり何本必要か</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">KPI</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">今の実績</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap text-amber-400">月の予算</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">今日まで<br/>やるべき本数</th>
                <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">状況</th>
                <th className="text-right px-4 py-2 font-semibold whitespace-nowrap text-cyan-300">今から<br/>1日あたり必要</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(r => r.pace).map(r => {
                const onPace = r.cumTarget > 0 ? r.total >= r.cumTarget : true
                const gap = Math.round((r.total - r.cumTarget) * 10) / 10
                const done = r.paceBase > 0 && r.total >= r.paceBase
                const overPace = r.reqDaily > 0 && r.cumTarget > 0 && (r.total < r.cumTarget)
                return (
                  <tr key={r.key} className={`border-b border-slate-800/40 hover:bg-slate-800/20 ${r.important ? 'bg-slate-800/30' : ''}`}>
                    <td className="px-4 py-2 font-semibold whitespace-nowrap" style={{ color: r.color }}>{r.important && '★ '}{r.label}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-slate-100">{r.total}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300">{r.budget || <span className="text-slate-600">未設定</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{r.cumTarget > 0 ? r.cumTarget : '—'}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {r.paceBase === 0 ? <span className="text-slate-600">—</span>
                        : done ? <span className="text-green-400 font-bold text-xs">✓ 達成</span>
                        : onPace ? <span className="text-cyan-400 text-xs">▲ {gap} 先行</span>
                        : <span className="text-red-400 font-bold text-xs">▼ {Math.abs(gap)} 不足</span>}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {done ? <span className="text-green-400 font-bold">完了</span>
                        : r.reqDaily > 0 ? <span className={`font-bold ${overPace ? 'text-red-300' : 'text-cyan-300'}`}>{r.reqDaily}<span className="text-[11px] text-slate-500"> 本/日</span></span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-slate-600 leading-relaxed">
            「今日までやるべき本数」＝予算ペースで今日時点で到達しておきたい数。「今から1日あたり必要」＝残り営業日で予算に届かせるのに毎日必要な本数。★＝重要KPI。
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
