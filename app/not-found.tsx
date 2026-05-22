export const dynamic = 'force-dynamic'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f1e] text-slate-200">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-slate-400 mb-6">ページが見つかりません</p>
      <Link
        href="/dashboard"
        className="px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700"
      >
        ダッシュボードに戻る
      </Link>
    </div>
  )
}
