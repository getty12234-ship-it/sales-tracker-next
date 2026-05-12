import { NippoView } from '@/components/dashboard/NippoView'
import { WeekNav } from '@/components/dashboard/WeekNav'

export default function NippoPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100 whitespace-nowrap">日報</h1>
        <WeekNav />
      </div>
      <NippoView />
    </div>
  )
}
