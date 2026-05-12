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

      {/* 今週 */}
      <section>
        <h2 className="text-sm font-semibold text-indigo-400 mb-3">
          📝 今週（{getWeekLabel(currentWeekStart)}）
        </h2>
        <ReviewSheet />
      </section>

      {/* 先週（読み取り専用） */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">
          📋 先週（{getWeekLabel(prevWeekStart)}）
        </h2>
        <ReviewSheet weekStart={prevWeekStart} readOnly={true} />
      </section>
    </div>
  )
}
