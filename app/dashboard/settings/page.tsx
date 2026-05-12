import { SettingsView } from '@/components/dashboard/SettingsView'

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-100 whitespace-nowrap">設定</h1>
      <SettingsView />
    </div>
  )
}
