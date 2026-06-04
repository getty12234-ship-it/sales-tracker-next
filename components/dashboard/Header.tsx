'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getMembers } from '@/lib/queries'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { Check, Loader2, Wifi, LogOut, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type SyncState = 'idle' | 'saving' | 'saved' | 'error'

// 同期状態をグローバルに管理するためのイベントシステム
export const syncEvents = {
  listeners: new Set<(s: SyncState) => void>(),
  emit(s: SyncState) {
    this.listeners.forEach(fn => fn(s))
  },
  subscribe(fn: (s: SyncState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export function Header() {
  const {
    currentMember, setCurrentMember,
    members, setMembers,
    currentTeam, setCurrentTeam,
    isAdmin,
  } = useAppState()
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const router = useRouter()

  const { data } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers,
    // 全ユーザーが取得（RLSにより自動的にアクセス可能な範囲(同じチーム+管理者は全員)のみ返る）
    enabled: !!currentMember || isAdmin,
  })

  useEffect(() => {
    if (data) setMembers(data)
  }, [data, setMembers])

  // チーム切り替え時: そのチームの最初のメンバーを自動選択（管理者のみ）
  useEffect(() => {
    if (!isAdmin) return
    const teamMembers = members.filter(m => (m.team || 'top') === currentTeam)
    if (teamMembers.length > 0) {
      if (!currentMember || (currentMember.team || 'top') !== currentTeam) {
        setCurrentMember(teamMembers[0])
      }
    } else if (currentMember) {
      // 選択チームにメンバーがいなければ選択解除（他チームのデータが残らないように）
      setCurrentMember(null)
    }
  }, [currentTeam, members, isAdmin, currentMember, setCurrentMember])

  // 初回: 管理者はコアチームの最初のメンバーを自動選択
  useEffect(() => {
    if (!isAdmin) return
    if (!currentMember && members.length > 0) {
      const coreMembers = members.filter(m => (m.team || 'top') === 'core')
      setCurrentMember(coreMembers[0] || members[0])
    }
  }, [members, currentMember, isAdmin, setCurrentMember])

  // 同期状態の購読
  useEffect(() => {
    const unsub = syncEvents.subscribe(setSyncState)
    return () => { unsub() }
  }, [])

  const handleMemberChange = (id: string | null) => {
    if (!id) return
    const m = members.find(m => m.id === id)
    if (m) setCurrentMember(m)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // 現在のチームのメンバーのみ表示
  const teamMembers = members.filter(m => (m.team || 'top') === currentTeam)

  return (
    <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-[#060d1f] shrink-0">
      {/* 左: チームトグル + メンバー表示 */}
      <div className="flex items-center gap-3">
        {/* 管理者のみチームトグルを表示 */}
        {isAdmin && (
          <div className="flex bg-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setCurrentTeam('core')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                currentTeam === 'core'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              コア
            </button>
            <button
              onClick={() => setCurrentTeam('top')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                currentTeam === 'top'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TOP
            </button>
            <button
              onClick={() => setCurrentTeam('second')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                currentTeam === 'second'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2ND
            </button>
            <button
              onClick={() => setCurrentTeam('third')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                currentTeam === 'third'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3RD
            </button>
            {/* 個人事業（原田さん専用・CoCoメンバーからは完全非表示。RLSでもデータ隔離） */}
            <button
              onClick={() => setCurrentTeam('jigyo')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                currentTeam === 'jigyo'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="個人事業（あなただけが見られる非公開エリア）"
            >
              <Lock className="w-3 h-3" />個人事業
            </button>
          </div>
        )}

        {currentMember && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: currentMember.color || '#6366f1' }}
          >
            {currentMember.name[0]}
          </div>
        )}

        {/* 管理者: メンバー選択ドロップダウン */}
        {isAdmin ? (
          <Select value={currentMember?.id || ''} onValueChange={handleMemberChange}>
            <SelectTrigger className="w-36 h-8 bg-slate-900 border-slate-700 text-sm">
              <SelectValue placeholder="メンバー選択">
                {currentMember?.name || 'メンバー選択'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-slate-200 focus:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: m.color || '#6366f1' }} />
                    {m.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          /* 一般メンバー: 自分の名前のみ表示 */
          <span className="text-sm font-medium text-slate-200">
            {currentMember?.name || ''}
          </span>
        )}
      </div>

      {/* 右: 同期状態 + ログアウト */}
      <div className="flex items-center gap-3">
        <SyncIndicator state={syncState} />
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded-md hover:bg-slate-800"
          title="ログアウト"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>ログアウト</span>
        </button>
      </div>
    </header>
  )
}

function SyncIndicator({ state }: { state: SyncState }) {
  if (state === 'saving') {
    return (
      <Badge variant="outline" className="border-yellow-600 text-yellow-400 text-xs gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        保存中...
      </Badge>
    )
  }
  if (state === 'saved') {
    return (
      <Badge variant="outline" className="border-green-700 text-green-400 text-xs gap-1">
        <Check className="w-3 h-3" />
        保存済み
      </Badge>
    )
  }
  if (state === 'error') {
    return (
      <Badge variant="outline" className="border-red-700 text-red-400 text-xs gap-1">
        <Wifi className="w-3 h-3" />
        エラー
      </Badge>
    )
  }
  return (
    <div className="w-2 h-2 rounded-full bg-green-500" title="接続中" />
  )
}
