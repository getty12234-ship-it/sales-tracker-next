import { DailyMetricsTable } from '@/components/dashboard/DailyMetricsTable'
import { WeekNav } from '@/components/dashboard/WeekNav'

export default function DailyPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100 whitespace-nowrap">日別数字</h1>
        <WeekNav />
      </div>
      <DailyMetricsTable />
    </div>
  )
}
