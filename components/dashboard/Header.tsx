'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getMembers } from '@/lib/queries'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { Check, Loader2, Wifi } from 'lucide-react'

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
  const { currentMember, setCurrentMember, members, setMembers } = useAppState()
  const [syncState, setSyncState] = useState<SyncState>('idle')

  const { data } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers,
  })

  useEffect(() => {
    if (data) {
      setMembers(data)
      // メンバーが未選択なら最初のメンバーを選択
      if (!currentMember && data.length > 0) {
        setCurrentMember(data[0])
      }
    }
  }, [data, currentMember, setCurrentMember, setMembers])

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

  return (
    <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-[#060d1f] shrink-0">
      {/* 左: メンバー選択 */}
      <div className="flex items-center gap-3">
        {currentMember && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: currentMember.color || '#6366f1' }}>
            {currentMember.name[0]}
          </div>
        )}
        <Select value={currentMember?.id || ''} onValueChange={handleMemberChange}>
          <SelectTrigger className="w-36 h-8 bg-slate-900 border-slate-700 text-sm">
            <SelectValue placeholder="メンバー選択" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            {members.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-slate-200 focus:bg-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: m.color || '#6366f1' }} />
                  {m.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 右: 同期状態 */}
      <div className="flex items-center gap-2">
        <SyncIndicator state={syncState} />
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
