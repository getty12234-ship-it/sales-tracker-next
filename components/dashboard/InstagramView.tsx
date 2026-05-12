'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getInstagramAccounts, getInstagramMetrics, upsertInstagramMetrics, createInstagramAccount } from '@/lib/queries'
import { getWeekDays, formatDateJa } from '@/lib/date-utils'
import { IG_METRIC_FIELDS } from '@/lib/constants'
import { syncEvents } from './Header'
import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Camera } from 'lucide-react'
import type { InstagramMetrics } from '@/lib/supabase'

// 簡易ID生成
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function InstagramView() {
  const { currentMember, currentWeekStart } = useAppState()
  const queryClient = useQueryClient()
  const weekDays = getWeekDays(currentWeekStart)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: accounts = [] } = useQuery({
    queryKey: ['ig_accounts', currentMember?.id],
    queryFn: () => getInstagramAccounts(currentMember?.id),
    enabled: !!currentMember,
  })

  // アカウント選択 (初回自動選択)
  const effectiveAccountId = selectedAccountId || accounts[0]?.id || null

  const { data: metrics = [] } = useQuery({
    queryKey: ['ig_metrics', effectiveAccountId, currentWeekStart],
    queryFn: () => getInstagramMetrics(effectiveAccountId!, weekDays[0], weekDays[6]),
    enabled: !!effectiveAccountId,
  })

  const metricsMap = Object.fromEntries(metrics.map(m => [m.date, m]))

  const { mutateAsync: save } = useMutation({
    mutationFn: upsertInstagramMetrics,
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['ig_metrics', effectiveAccountId, currentWeekStart],
        (old: InstagramMetrics[] = []) => {
          const idx = old.findIndex(m => m.date === data.date)
          if (idx >= 0) { const next = [...old]; next[idx] = data; return next }
          return [...old, data]
        }
      )
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  const { mutateAsync: addAccount } = useMutation({
    mutationFn: ({ id, name, url, memberId }: { id: string; name: string; url: string; memberId: string }) =>
      createInstagramAccount(id, name, url, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ig_accounts'] })
      setDialogOpen(false)
      setNewName('')
      setNewUrl('')
    },
  })

  const handleChange = useCallback((date: string, field: string, value: number) => {
    if (!effectiveAccountId) return

    queryClient.setQueryData(
      ['ig_metrics', effectiveAccountId, currentWeekStart],
      (old: InstagramMetrics[] = []) => {
        const existing = old.find(m => m.date === date)
        if (existing) return old.map(m => m.date === date ? { ...m, [field]: value } : m)
        return [...old, { account_id: effectiveAccountId, date, [field]: value } as InstagramMetrics]
      }
    )

    const key = `${effectiveAccountId}_${date}`
    if (saveTimers.has(key)) clearTimeout(saveTimers.get(key)!)
    syncEvents.emit('saving')

    saveTimers.set(key, setTimeout(async () => {
      const current = (queryClient.getQueryData<InstagramMetrics[]>(
        ['ig_metrics', effectiveAccountId, currentWeekStart]
      ) || []).find(m => m.date === date)

      await save({
        account_id: effectiveAccountId,
        date,
        follows: 0, followers: 0, dm_send: 0, dm_reply: 0,
        ig_offer: 0, ig_apo_get: 0, ig_apo_exec: 0, ig_doin_exec: 0, ig_seiyaku: 0,
        ...current,
      })
      saveTimers.delete(key)
    }, 600))
  }, [effectiveAccountId, currentWeekStart, queryClient, save])

  if (!currentMember) {
    return <div className="text-slate-500 text-sm p-8 text-center">メンバーを選択してください</div>
  }

  return (
    <div className="space-y-4">
      {/* アカウント選択 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Camera className="w-4 h-4 text-pink-400" />
            <span className="text-xs text-slate-400">アカウント:</span>
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  effectiveAccountId === acc.id
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {acc.name}
              </button>
            ))}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 text-xs text-pink-400 hover:text-pink-300" />}>
                <Plus className="w-3.5 h-3.5 mr-1" />追加
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-slate-200">アカウント追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    className="bg-slate-950 border-slate-700 text-sm"
                    placeholder="アカウント名"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                  <Input
                    className="bg-slate-950 border-slate-700 text-sm"
                    placeholder="Instagram URL"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                  />
                  <Button
                    className="w-full bg-pink-600 hover:bg-pink-700"
                    onClick={() => addAccount({ id: genId(), name: newName, url: newUrl, memberId: currentMember.id })}
                    disabled={!newName}
                  >
                    追加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* メトリクステーブル */}
      {effectiveAccountId ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm border-collapse" style={{ minWidth: '700px' }}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-950 text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider w-28 z-10">項目</th>
                {weekDays.map(date => (
                  <th key={date} className="px-2 py-3 text-center text-xs text-slate-400 font-medium whitespace-nowrap">
                    {formatDateJa(date)}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs text-pink-400 font-bold">合計</th>
              </tr>
            </thead>
            <tbody>
              {IG_METRIC_FIELDS.map(({ key, label }) => {
                const total = weekDays.reduce((sum, date) =>
                  sum + ((metricsMap[date]?.[key as keyof InstagramMetrics] as number) || 0), 0)
                return (
                  <tr key={key} className="hover:bg-slate-900/50 transition-colors">
                    <td className="sticky left-0 bg-[#0a0f1e] hover:bg-slate-900/50 px-4 py-1 text-xs text-slate-300 font-medium z-10 whitespace-nowrap">
                      {label}
                    </td>
                    {weekDays.map(date => (
                      <td key={date} className="px-1 py-1">
                        <input
                          type="number"
                          min={0}
                          className="metric-input"
                          value={(metricsMap[date]?.[key as keyof InstagramMetrics] as number) || ''}
                          placeholder="0"
                          onChange={e => handleChange(date, key, parseInt(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1 text-center font-bold text-pink-300 text-sm">
                      {total || ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-slate-500 text-sm p-8 text-center">
          アカウントを追加してください
        </div>
      )}
    </div>
  )
}
