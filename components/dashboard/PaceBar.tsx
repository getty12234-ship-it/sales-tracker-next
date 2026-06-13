'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cumulativeBudgetTarget, weeklyTarget, weeklyCumulativeTarget } from '@/lib/date-utils'

// =====================================================================
// 共通「バー表示」部品
//   実績フィル ＋ 🟡予算ペース線 ＋ 🩵目標ペース線
//   - 月次でも週次でも同じ見た目（ペース線の中身を呼び出し側が決める）
//   - budgetPace/goalPace = 「今（今日／今週）ここまで到達しておきたい」位置
// =====================================================================

const round1 = (n: number) => Math.round(n * 10) / 10

// バー本体（フィル＋2本のペース線）
//   scaleOverride: 複数バー(月間/今週/先週など)を同一スケールで並べたい時に共通の満額スケールを渡す
export function PaceBarTrack({
  value, budget, goal, budgetPace, goalPace, color, height = 'h-2.5', scaleOverride,
}: {
  value: number; budget: number; goal: number
  budgetPace: number; goalPace: number; color: string; height?: string; scaleOverride?: number
}) {
  // ライン位置の基準＝満額スケール（共通指定があればそれ。無ければこのバーの予算/目標の大きい方）。
  // value をスケールに混ぜると実績が増えるほどペース線が左へ動いて不安定になるため、基準は満額側に固定し、
  // value が満額を超える時だけスケールを value まで広げてフィルを100%キャップする。
  const baseScale = (scaleOverride && scaleOverride > 0) ? scaleOverride : Math.max(goal, budget, 1)
  const scaleMax = Math.max(baseScale, value, 1)
  const actualPct = Math.min(100, (value / scaleMax) * 100)
  const budgetLine = budget > 0 ? Math.min(100, (budgetPace / scaleMax) * 100) : null
  const goalLine = goal > 0 ? Math.min(100, (goalPace / scaleMax) * 100) : null
  // 遅れ判定：予算があれば予算ペース、なければ目標ペースで判定（予算未設定KPIで赤が死なないように）
  const pace = budget > 0 ? budgetPace : (goal > 0 ? goalPace : 0)
  const onPace = pace <= 0 || value >= pace
  const hitTarget = (budget || goal) > 0 && value >= (budget || goal)
  // 達成(予算=絶対達成クリア)→緑 / ペース内→本来色 / 遅れ→赤
  const fillColor = hitTarget ? '#22c55e' : onPace ? color : '#ef4444'

  return (
    <div className={`relative w-full ${height} bg-slate-800 rounded-full overflow-hidden`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${actualPct}%`, background: fillColor }} />
      {budgetLine !== null && (
        <div className="absolute top-0 h-full w-[2px] bg-amber-400 z-10" style={{ left: `calc(${budgetLine}% - 1px)` }}
          title={`今ここまで到達しておきたい（予算ペース）: ${round1(budgetPace)}`} />
      )}
      {goalLine !== null && (
        <div className="absolute top-0 h-full w-[2px] bg-cyan-400 z-10" style={{ left: `calc(${goalLine}% - 1px)` }}
          title={`今ここまで到達しておきたい（目標ペース）: ${round1(goalPace)}`} />
      )}
    </div>
  )
}

// 凡例（線の意味）。paceWord = '今日'（月次）/ '今週'（週次）
export function PaceLegend({ paceWord = '今日' }: { paceWord?: string }) {
  return (
    <div className="flex items-center gap-3 text-[9px] text-slate-500 flex-wrap">
      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-slate-400" />実績</span>
      <span className="flex items-center gap-1"><span className="inline-block w-[2px] h-2.5 bg-amber-400" />{paceWord}の予算ライン</span>
      <span className="flex items-center gap-1"><span className="inline-block w-[2px] h-2.5 bg-cyan-400" />{paceWord}の目標ライン</span>
    </div>
  )
}

// カード版（月次グリッド用）— 大きい数字＋バー＋凡例
export function PaceCard({
  label, value, goal, budget, color, important, budgetPace, goalPace, paceWord = '今日', footer,
}: {
  label: string; value: number; goal: number; budget: number; color: string; important?: boolean
  budgetPace: number; goalPace: number; paceWord?: string; footer?: React.ReactNode
}) {
  return (
    <Card className={`bg-slate-900 border-slate-800 ${important ? 'ring-1 ring-indigo-500/30' : ''}`}>
      <CardContent className="p-3">
        <div className="text-xs text-slate-500 mb-1 truncate">{label}</div>
        <div className="flex items-baseline justify-between mb-2.5">
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          <div className="text-right text-xs leading-tight">
            {budget > 0 && <div className="text-amber-400">予算{budget}</div>}
            {goal > 0 && <div className="text-cyan-400/80">目標{goal}</div>}
          </div>
        </div>
        <PaceBarTrack value={value} budget={budget} goal={goal} budgetPace={budgetPace} goalPace={goalPace} color={color} />
        <div className="mt-1.5">
          <PaceLegend paceWord={paceWord} />
        </div>
        {footer && <div className="mt-1.5 pt-1.5 border-t border-slate-800/60">{footer}</div>}
      </CardContent>
    </Card>
  )
}

// =====================================================================
// 3期間バー（月間／今週／先週）を1カードにまとめる版
// =====================================================================
export type PaceWindow = {
  name: string        // '月間' | '今週' | '先週'
  value: number
  budget: number
  goal: number
  budgetPace: number
  goalPace: number
}

// 月間/今週/先週の3 windowを一括生成
//   monthlyBudget/monthlyGoal = 月の予算/目標。週はそれを平日按分。
export function buildPaceWindows(args: {
  monthVal: number; weekVal: number; lastWeekVal: number
  monthlyBudget: number; monthlyGoal: number
  ym: string; weekStart: string; lastWeekStart: string
}): PaceWindow[] {
  const { monthVal, weekVal, lastWeekVal, monthlyBudget: b, monthlyGoal: g, ym, weekStart, lastWeekStart } = args
  return [
    {
      name: '月間', value: monthVal, budget: b, goal: g,
      budgetPace: b > 0 ? cumulativeBudgetTarget(b, ym) : 0,
      goalPace: g > 0 ? cumulativeBudgetTarget(g, ym) : 0,
    },
    {
      name: '今週', value: weekVal, budget: weeklyTarget(b, weekStart), goal: weeklyTarget(g, weekStart),
      budgetPace: weeklyCumulativeTarget(b, weekStart), goalPace: weeklyCumulativeTarget(g, weekStart),
    },
    {
      name: '先週', value: lastWeekVal, budget: weeklyTarget(b, lastWeekStart), goal: weeklyTarget(g, lastWeekStart),
      budgetPace: weeklyCumulativeTarget(b, lastWeekStart), goalPace: weeklyCumulativeTarget(g, lastWeekStart),
    },
  ]
}

// 1KPI = 月間/今週/先週の3本バーカード
export function MultiPaceCard({
  label, color, important, windows, footer,
}: {
  label: string; color: string; important?: boolean
  windows: PaceWindow[]; footer?: React.ReactNode
}) {
  return (
    <Card className={`bg-slate-900 border-slate-800 ${important ? 'ring-1 ring-indigo-500/30' : ''}`}>
      <CardContent className="p-3">
        <div className="text-sm font-bold mb-2 truncate" style={{ color }}>{important && '★ '}{label}</div>
        <div className="space-y-2">
          {windows.map(w => (
            <div key={w.name}>
              <div className="flex items-center gap-1.5 text-[10px] leading-tight mb-0.5">
                <span className="text-slate-500 w-7 shrink-0">{w.name}</span>
                <span className="text-sm font-bold text-slate-100">{round1(w.value)}</span>
                <span className="ml-auto tabular-nums">
                  <span className="text-amber-400/80">予{w.budget ? round1(w.budget) : '—'}</span>
                  {' '}
                  <span className="text-cyan-400/70">目{w.goal ? round1(w.goal) : '—'}</span>
                </span>
              </div>
              <PaceBarTrack
                value={w.value} budget={w.budget} goal={w.goal}
                budgetPace={w.budgetPace} goalPace={w.goalPace} color={color} height="h-2"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[9px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block w-[2px] h-2.5 bg-amber-400" />予算ライン</span>
          <span className="flex items-center gap-1"><span className="inline-block w-[2px] h-2.5 bg-cyan-400" />目標ライン</span>
          <span className="text-slate-600">＝各期間で“今ここまで”の目印</span>
        </div>
        {footer && <div className="mt-1.5 pt-1.5 border-t border-slate-800/60">{footer}</div>}
      </CardContent>
    </Card>
  )
}

// 行版（リスト用・コンパクト）— [ラベル][実績] [バー] [予算/目標]
export function PaceRow({
  label, value, goal, budget, color, important, budgetPace, goalPace,
}: {
  label: string; value: number; goal: number; budget: number; color: string; important?: boolean
  budgetPace: number; goalPace: number
}) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-slate-800/50">
      <span className="text-xs w-16 shrink-0 truncate" style={{ color }}>{important && '★'}{label}</span>
      <span className="text-sm font-bold w-7 text-right text-slate-100 shrink-0">{value}</span>
      <div className="flex-1 min-w-0">
        <PaceBarTrack value={value} budget={budget} goal={goal} budgetPace={budgetPace} goalPace={goalPace} color={color} height="h-2" />
      </div>
      <span className="text-[10px] text-slate-500 w-24 text-right shrink-0 tabular-nums">
        <span className="text-amber-400/80">予{budget ? round1(budget) : '—'}</span>
        {' '}
        <span className="text-cyan-400/70">目{goal ? round1(goal) : '—'}</span>
      </span>
    </div>
  )
}
