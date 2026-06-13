'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getAllMembersMetrics, getAllMembersSettings, getInstagramAccounts, getInstagramMetricsByAccounts } from '@/lib/queries'
import { today, getWeekStart, currentYearMonth, endOfMonth } from '@/lib/date-utils'
import { KPI_SUMMARY, METRIC_FIELDS } from '@/lib/constants'
import { extractBudgets } from '@/lib/supabase'
import { resolveCwGoal, resolveIgGoalCombined } from '@/lib/goals'
import type { DailyMetrics, InstagramMetrics } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ChevronUp, ChevronDown, Minus } from 'lucide-react'

type Period = 'today' | 'week' | 'month'

function getPeriodRange(period: Period): [string, string] {
  const t = today()
  if (period === 'today') return [t, t]
  if (period === 'week') return [getWeekStart(t), t]
  // 月レンジ終端は暦月末に揃える（他ビューは月末まで集計。today終端だと未来日先行入力を取りこぼし数値が割れる）
  const ym = currentYearMonth()
  return [`${ym}-01`, endOfMonth(ym)]
}

export function TeamSummary() {
  const { members: allMembers, currentTeam } = useAppState()
  // 現在のチームのメンバーのみ表示（is_admin=trueはログイン専用なのでチーム一覧から除外）
  const members = allMembers.filter(m => (m.team || 'top') === currentTeam && !m.is_admin)
  const [period, setPeriod] = useState<Period>('month')
  const [sortKey, setSortKey] = useState('seiyaku')
  const [sortAsc, setSortAsc] = useState(false)

  const [from, to] = getPeriodRange(period)
  const memberIds = members.map(m => m.id)

  const { data: allMetrics = [], isLoading } = useQuery({
    queryKey: ['all_members_metrics', memberIds.join(','), from, to],
    queryFn: () => getAllMembersMetrics(memberIds, from, to),
    enabled: memberIds.length > 0,
  })

  const { data: allSettings = [] } = useQuery({
    queryKey: ['all_members_settings', memberIds.join(',')],
    queryFn: () => getAllMembersSettings(memberIds),
    enabled: memberIds.length > 0,
  })

  // インスタ：チームメンバー全員のアカウント → そのメトリクスを期間取得（統合サマリーと数字を一致させるため合算する）
  const { data: igAccounts = [] } = useQuery({
    queryKey: ['team_ig_accounts', memberIds.join(',')],
    queryFn: async () => {
      const all = await getInstagramAccounts()
      return all.filter(a => memberIds.includes(a.member_id))
    },
    enabled: memberIds.length > 0,
  })
  const igAccountIds = igAccounts.map(a => a.id)
  const { data: igMetrics = [] } = useQuery({
    queryKey: ['team_ig_metrics', igAccountIds.join(','), from, to],
    queryFn: () => getInstagramMetricsByAccounts(igAccountIds, from, to),
    enabled: igAccountIds.length > 0,
  })
  // account_id → member_id 対応表
  const accToMember = useMemo(() => {
    const m: Record<string, string> = {}
    igAccounts.forEach(a => { m[a.id] = a.member_id })
    return m
  }, [igAccounts])

  // KPIキー → インスタ列キー（post→posts、それ以外は ig_<key>）
  const igFieldFor = (key: string) => (key === 'post' ? 'posts' : `ig_${key}`)
  // インスタ実績を合算するKPI＝統合サマリーの UNIFIED_KPIS で igKey!=null の集合と完全一致させる。
  // ※ ここに無いKPI(post/offer/line_exchange/mendan_exec)へIG加算すると、CWのみ表示の
  //    統合サマリー/その他ビューと同一KPIの実績が食い違う（例: 面談実施 4 vs 6）。
  const IG_ADD_KEYS = new Set(['apo_get', 'apo_exec', 'doin_get', 'doin_exec', 'seiyaku'])

  // メンバーごとに集計（その他＋インスタ合算。統合サマリーと完全に同じ規約）
  const memberStats = useMemo(() => {
    return members.map(member => {
      const memberMetrics = allMetrics.filter(m => m.member_id === member.id)
      const memberIg = igMetrics.filter(m => accToMember[m.account_id] === member.id)
      const totals: Record<string, number> = {}
      METRIC_FIELDS.forEach(({ key }) => {
        totals[key] = memberMetrics.reduce(
          (sum, m) => sum + ((m[key as keyof DailyMetrics] as number) || 0), 0
        )
      })
      // 統合サマリーと同じKPIにだけインスタ実績を加算（他は加算するとCWのみ表示の他画面とズレる）
      KPI_SUMMARY.forEach(({ key }) => {
        if (!IG_ADD_KEYS.has(key)) return
        const igField = igFieldFor(key)
        totals[key] = (totals[key] || 0) + memberIg.reduce(
          (sum, m) => sum + ((m[igField as keyof InstagramMetrics] as number) || 0), 0
        )
      })
      // 目標解決は lib/goals.ts に集約（統合サマリーと完全に同じ＝CWは予算ゲート、IGは予算ゲートでDEFAULT焼き込み残骸を無視）。
      // ※ resolveIgGoalCombined には単ig の igFieldFor(key)(='ig_apo_exec'/'posts')を渡す。内部で更に ig_/b_ig_ を付けるため
      //    'ig_'+igFieldFor(key) を渡すと三重ig になり全IG目標が0に潰れる。
      const settings = allSettings.find(s => s.member_id === member.id)
      const rawGoals = (settings?.goals as Record<string, number>) || {}
      const budgets = extractBudgets(rawGoals)
      const goals: Record<string, number> = {}
      KPI_SUMMARY.forEach(({ key }) => {
        // IG目標も実績と同じKPIにだけ合算する（offer/line_exchange等を足すとCWのみ表示の他画面と目標が割れる）
        const ig = IG_ADD_KEYS.has(key) ? resolveIgGoalCombined(rawGoals, igFieldFor(key)) : 0
        goals[key] = resolveCwGoal(rawGoals, budgets, key) + ig
      })
      return { member, totals, goals }
    })
  }, [members, allMetrics, igMetrics, accToMember, allSettings])

  // ソート
  const sorted = useMemo(() => {
    return [...memberStats].sort((a, b) => {
      const diff = (b.totals[sortKey] || 0) - (a.totals[sortKey] || 0)
      return sortAsc ? -diff : diff
    })
  }, [memberStats, sortKey, sortAsc])

  function handleSort(key: string) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  // トップ3を取得
  function topByKey(key: string) {
    return [...memberStats]
      .sort((a, b) => (b.totals[key] || 0) - (a.totals[key] || 0))
      .slice(0, 3)
  }

  const periodLabel = period === 'today' ? '今日' : period === 'week' ? '今週' : '今月'
  const medals = ['🥇', '🥈', '🥉']

  const TOP_RANKINGS = [
    { key: 'seiyaku',   label: '成約',    color: '#22c55e', icon: '🏆' },
    { key: 'doin_exec', label: '動員実施', color: '#8b5cf6', icon: '🎯' },
    { key: 'apo_exec',  label: 'アポ実施', color: '#06b6d4', icon: '📞' },
  ]

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        メンバーを設定してください
      </div>
    )
  }

  // 合計行
  const teamTotals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    teamTotals[key] = memberStats.reduce((sum, s) => sum + (s.totals[key] || 0), 0)
  })

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          チームサマリー
          <span className="text-xs font-normal text-slate-500 ml-1">{members.length}名</span>
          <span className="text-[10px] font-normal text-slate-600 ml-1">その他＋インスタ合算</span>
        </h1>
        {/* 期間タブ */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p === 'today' ? '今日' : p === 'week' ? '今週' : '今月'}
            </button>
          ))}
        </div>
      </div>

      {/* チーム合計 KPI */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        {KPI_SUMMARY.map(({ key, label, color, important }) => (
          <Card
            key={key}
            className={`bg-slate-900 border-slate-800 cursor-pointer transition-all ${
              sortKey === key ? 'ring-1 ring-indigo-500' : ''
            } ${important ? 'ring-1 ring-indigo-500/20' : ''}`}
            onClick={() => handleSort(key)}
          >
            <CardContent className="p-2.5">
              <div className="text-xs text-slate-500 mb-1 truncate">{label}</div>
              <div className="text-xl font-bold" style={{ color }}>
                {teamTotals[key] || 0}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">チーム計</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TOP 3 ランキング */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TOP_RANKINGS.map(({ key, label, color, icon }) => {
          const top = topByKey(key)
          return (
            <Card key={key} className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span>{icon}</span>
                  {label} TOP3
                  <span className="text-slate-600 ml-auto">{periodLabel}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2.5">
                {top.map((s, i) => {
                  const val = s.totals[key] || 0
                  return (
                    <div key={s.member.id} className="flex items-center gap-2">
                      <span className="text-lg w-7 shrink-0">{medals[i]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {s.member.name}
                        </div>
                        {/* ミニプログレスバー */}
                        {val > 0 && top[0].totals[key] > 0 && (
                          <div className="h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((val / top[0].totals[key]) * 100)}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <span className="text-base font-bold shrink-0" style={{ color }}>
                        {val}
                      </span>
                    </div>
                  )
                })}
                {top.length === 0 && (
                  <div className="text-xs text-slate-600 py-2">データなし</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 全メンバー比較テーブル */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            全メンバー比較
            <span className="text-xs text-slate-500 font-normal">
              ヘッダーをクリックでソート
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-slate-500 text-sm py-12 text-center">読み込み中...</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2.5 px-4 text-slate-500 font-semibold bg-slate-900 sticky left-0 z-10 min-w-[110px] whitespace-nowrap">
                    メンバー
                  </th>
                  {KPI_SUMMARY.map(({ key, label, color }) => (
                    <th
                      key={key}
                      className="py-2.5 px-3 text-right cursor-pointer select-none whitespace-nowrap transition-colors hover:bg-slate-800/50"
                      style={{ color: sortKey === key ? color : '#64748b' }}
                      onClick={() => handleSort(key)}
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        {label}
                        {sortKey === key ? (
                          sortAsc
                            ? <ChevronUp className="w-3 h-3 shrink-0" />
                            : <ChevronDown className="w-3 h-3 shrink-0" />
                        ) : (
                          <Minus className="w-3 h-3 shrink-0 opacity-20" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, idx) => (
                  <tr
                    key={s.member.id}
                    className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors"
                  >
                    {/* メンバー名 */}
                    <td className="py-2.5 px-4 sticky left-0 bg-slate-900 z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 font-mono w-4 text-right shrink-0 text-xs">
                          {idx + 1}
                        </span>
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.member.color || '#6366f1' }}
                        />
                        <span className="font-semibold text-slate-200 whitespace-nowrap">
                          {s.member.name}
                        </span>
                      </div>
                    </td>

                    {/* 各KPI */}
                    {KPI_SUMMARY.map(({ key, color, important }) => {
                      const val = s.totals[key] || 0
                      const goal = s.goals[key] || 0
                      const rate = goal > 0 ? Math.min(100, Math.round((val / goal) * 100)) : 0
                      const isActiveSort = sortKey === key

                      return (
                        <td
                          key={key}
                          className={`py-2.5 px-3 text-right ${isActiveSort ? 'bg-slate-800/30' : ''}`}
                        >
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className="font-bold text-sm leading-none"
                              style={{ color: val > 0 ? (important ? color : '#e2e8f0') : '#475569' }}
                            >
                              {val}
                            </span>
                            {goal > 0 && period === 'month' && (
                              <div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${rate}%`,
                                    backgroundColor:
                                      rate >= 100 ? '#22c55e' :
                                      rate >= 70  ? '#f59e0b' :
                                      color,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>

              {/* 合計行 */}
              <tfoot>
                <tr className="border-t-2 border-slate-700">
                  <td className="py-2.5 px-4 sticky left-0 bg-slate-900 z-10">
                    <span className="text-xs font-bold text-slate-400">
                      チーム合計
                    </span>
                  </td>
                  {KPI_SUMMARY.map(({ key, color }) => (
                    <td key={key} className="py-2.5 px-3 text-right">
                      <span className="font-bold text-sm" style={{ color }}>
                        {teamTotals[key] || 0}
                      </span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
