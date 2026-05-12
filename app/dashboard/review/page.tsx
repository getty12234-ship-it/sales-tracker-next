import { ReviewSheet } from '@/components/dashboard/ReviewSheet'
import { WeekNav } from '@/components/dashboard/WeekNav'

export default function ReviewPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100 whitespace-nowrap">施策シート</h1>
        <WeekNav />
      </div>
      <ReviewSheet />
    </div>
  )
}
