import { GoalsView } from '@/components/dashboard/GoalsView'

export default function GoalsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-100 whitespace-nowrap">ゴールロードマップ</h1>
      <GoalsView />
    </div>
  )
}
