'use client'

import { ReviewSheet } from '@/components/dashboard/ReviewSheet'
import { WeekNav } from '@/components/dashboard/WeekNav'
import { useAppState } from '@/lib/store'
import { addWeeks, getWeekLabel } from '@/lib/date-utils'

export default function ReviewPage() {
  const { currentWeekStart } = useAppState()
  const prevWeekStart = addWeeks(currentWeekStart, -1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100 whitespace-nowrap">施策シート</h1>
        <WeekNav />
      </div>

      {/* 先週（読み取り専用）→ 先に確認 */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          📋 先週の施策確認
          <span className="text-xs font-normal text-slate-500">（{getWeekLabel(prevWeekStart)}）</span>
        </h2>
        <ReviewSheet weekStart={prevWeekStart} readOnly={true} />
      </section>

      {/* 今週 */}
      <section>
        <h2 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
          ✏️ 今週の施策入力
          <span className="text-xs font-normal text-indigo-300/60">（{getWeekLabel(currentWeekStart)}）</span>
        </h2>
        <ReviewSheet />
      </section>
    </div>
  )
}
