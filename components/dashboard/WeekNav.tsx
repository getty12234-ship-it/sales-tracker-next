'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppState } from '@/lib/store'
import { addWeeks, getWeekLabel } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'

export function WeekNav() {
  const { currentWeekStart, setCurrentWeekStart } = useAppState()

  return (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
      <Button
        variant="ghost" size="icon"
        className="h-6 w-6 text-slate-400 hover:text-white"
        onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-sm font-medium text-slate-200 w-48 text-center select-none">
        {getWeekLabel(currentWeekStart)}
      </span>
      <Button
        variant="ghost" size="icon"
        className="h-6 w-6 text-slate-400 hover:text-white"
        onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  )
}
