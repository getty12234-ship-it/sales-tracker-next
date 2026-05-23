'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type Team = 'top' | 'second' | 'third'
type Tab = 'login' | 'signup'

const TEAM_OPTIONS: { value: Team; label: string; bg: string }[] = [
  { value: 'top',    label: 'チームTOP', bg: 'bg-indigo-600' },
  { value: 'second', label: 'チーム2nd', bg: 'bg-purple-600' },
  { value: 'third',  label: 'チーム3rd', bg: 'bg-emerald-600' },
]

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login')
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#060d1f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center">
            <span className="text-white font-bold text-xl">ST</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-3">Sales Tracker</h1>
          <p className="text-slate-400 text-sm">営業チーム管理ツール</p>
        </div>

        {/* タブ切り替え */}
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          <button onClick={() => setTab('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >ログイン</button>
          <button onClick={() => setTab('signup')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'signup' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >新規登録</button>
        </div>

        {tab === 'login' ? <LoginForm router={router} /> : <SignupForm router={router} />}
      </div>
    </div>
  )
}

function InputField({ label, type, value, onChange, placeholder, autoComplete }: {
  label: string; type: string; value: string
  onChange: (v: string) => void; placeholder: string; autoComplete?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 bg-slate-800 border border-slate-700 rounded-lg px-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        placeholder={placeholder} required autoComplete={autoComplete}
      />
    </div>
  )
}

function LoginForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('メールアドレスまたはパスワードが違います'); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <form onSubmit={handle} className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
      <InputField label="メールアドレス" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
      <InputField label="パスワード" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
      {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />ログイン中...</> : 'ログイン'}
      </button>
    </form>
  )
}

function SignupForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [team, setTeam] = useState<Team>('top')
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('名前を入力してください'); return }
    if (password.length < 6) { setError('パスワードは6文字以上にしてください'); return }
    setLoading(true); setError('')
    try {
      const { data, error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) throw new Error(authErr.message)
      if (!data.user) throw new Error('ユーザー作成に失敗しました')
      const { error: mErr } = await supabase
        .from('st_members')
        .insert({ name: name.trim(), color, team, user_id: data.user.id })
      if (mErr) throw new Error('メンバー登録に失敗: ' + mErr.message)
      await supabase.auth.signInWithPassword({ email, password })
      router.push('/dashboard'); router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
      <InputField label="名前" type="text" value={name} onChange={setName} placeholder="山田 花子" />

      {/* チーム選択 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-400">チーム</label>
        <div className="grid grid-cols-3 gap-2">
          {TEAM_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setTeam(opt.value)}
              className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                team === opt.value
                  ? `${opt.bg} text-white border-transparent`
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* アイコンカラー */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-400">アイコンカラー</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <InputField label="メールアドレス" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
      <InputField label="パスワード（6文字以上）" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" />

      {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />登録中...</> : 'アカウントを作成'}
      </button>
      <p className="text-center text-xs text-slate-600">登録後すぐにダッシュボードを利用できます</p>
    </form>
  )
}
