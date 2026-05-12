import { Providers } from '@/app/providers'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

// クライアントサイドのみで動作するので静的プリレンダリングを無効化
export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <DashboardShell>{children}</DashboardShell>
    </Providers>
  )
}
