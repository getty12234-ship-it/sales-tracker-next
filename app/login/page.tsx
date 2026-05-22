'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('メールアドレスまたはパスワードが違います')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[#060d1f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* ロゴ */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center">
            <span className="text-white font-bold text-xl">ST</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-3">Sales Tracker</h1>
          <p className="text-slate-400 text-sm">営業チーム管理ツール</p>
        </div>

        {/* フォーム */}
        <form
          onSubmit={handleLogin}
          className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-9 bg-slate-800 border border-slate-700 rounded-lg px-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-9 bg-slate-800 border border-slate-700 rounded-lg px-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                ログイン中...
              </>
            ) : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          アカウントはチーム管理者から発行されます
        </p>
      </div>
    </div>
  )
}
