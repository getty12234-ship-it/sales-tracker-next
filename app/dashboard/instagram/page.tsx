import { InstagramView } from '@/components/dashboard/InstagramView'
import { WeekNav } from '@/components/dashboard/WeekNav'

export default function InstagramPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100 whitespace-nowrap">インスタ数字</h1>
        <WeekNav />
      </div>
      <InstagramView />
    </div>
  )
}
