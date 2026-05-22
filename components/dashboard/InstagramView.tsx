'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getInstagramAccounts, getInstagramMetrics, getInstagramMonthlyMetrics, upsertInstagramMetrics, createInstagramAccount } from '@/lib/queries'
import { getWeekDays, formatDateJa, currentYearMonth, pct } from '@/lib/date-utils'
import { IG_METRIC_FIELDS } from '@/lib/constants'
import { syncEvents } from './Header'
import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Camera, TrendingUp, Download, Table2 } from 'lucide-react'
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

  // 月間データ（全アカウント）
  const ym = currentYearMonth()
  const monthlyQueries = accounts.map(acc => ({
    id: acc.id,
    name: acc.name,
  }))

  const { data: monthlyMetricsList = [] } = useQuery({
    queryKey: ['ig_monthly_all', accounts.map(a => a.id).join(','), ym],
    queryFn: async () => {
      const results = await Promise.all(
        accounts.map(acc => getInstagramMonthlyMetrics(acc.id, ym))
      )
      return accounts.map((acc, i) => ({
        account: acc,
        metrics: results[i],
      }))
    },
    enabled: accounts.length > 0,
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

      {/* 確認数字（自動計算） */}
      {effectiveAccountId && (() => {
        const totals = Object.fromEntries(
          IG_METRIC_FIELDS.map(({ key }) => [
            key, weekDays.reduce((s, d) => s + ((metricsMap[d]?.[key as keyof typeof metricsMap[string]] as number) || 0), 0)
          ])
        ) as Record<string, number>
        const kpis = [
          { label: 'DM返信率',   value: pct(totals.dm_reply,    totals.dm_send),      color: '#60a5fa' },
          { label: 'オファー率', value: pct(totals.ig_offer,    totals.dm_reply),     color: '#f59e0b' },
          { label: 'アポ獲得率', value: pct(totals.ig_apo_get,  totals.ig_offer),     color: '#a78bfa' },
          { label: 'アポ実施率', value: pct(totals.ig_apo_exec, totals.ig_apo_get),   color: '#06b6d4' },
          { label: '動員実施率', value: pct(totals.ig_doin_exec,totals.ig_apo_exec),  color: '#8b5cf6' },
          { label: '成約率',     value: pct(totals.ig_seiyaku,  totals.ig_doin_exec), color: '#22c55e' },
        ]
        return (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-pink-400" />
                確認数字（自動計算）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {kpis.map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-800/60 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 mb-1">{label}</div>
                    <div className="text-xl font-bold" style={{ color }}>{value}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })()}

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

      {/* 月間アカウント別サマリーテーブル */}
      {monthlyMetricsList.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Table2 className="w-4 h-4 text-pink-400" />
                月間アカウント別サマリー（{ym.replace('-', '年')}月）
              </CardTitle>
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs text-slate-400 hover:text-slate-200 border border-slate-700"
                onClick={() => {
                  const headers = ['アカウント', ...IG_METRIC_FIELDS.map(f => f.label)]
                  const rows = monthlyMetricsList.map(({ account, metrics }) => {
                    const sums = IG_METRIC_FIELDS.map(({ key }) =>
                      metrics.reduce((s, m) => s + ((m[key as keyof InstagramMetrics] as number) || 0), 0)
                    )
                    return [account.name, ...sums.map(String)]
                  })
                  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
                  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `ig_${ym}.csv`; a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1" />CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold whitespace-nowrap sticky left-0 bg-slate-900 z-10">アカウント</th>
                  {IG_METRIC_FIELDS.map(({ key, label }) => (
                    <th key={key} className="px-3 py-2 text-right text-slate-500 font-semibold whitespace-nowrap">{label}</th>
                  ))}
                  <th className="px-3 py-2 text-right text-pink-400 font-semibold whitespace-nowrap">DM返信率</th>
                  <th className="px-3 py-2 text-right text-amber-400 font-semibold whitespace-nowrap">オファー率</th>
                  <th className="px-3 py-2 text-right text-green-400 font-semibold whitespace-nowrap">成約率</th>
                </tr>
              </thead>
              <tbody>
                {monthlyMetricsList.map(({ account, metrics }) => {
                  const sums: Record<string, number> = {}
                  IG_METRIC_FIELDS.forEach(({ key }) => {
                    sums[key] = metrics.reduce((s, m) => s + ((m[key as keyof InstagramMetrics] as number) || 0), 0)
                  })
                  return (
                    <tr key={account.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                      <td className="px-4 py-2 font-semibold text-slate-200 sticky left-0 bg-slate-900 z-10 whitespace-nowrap">
                        {account.name}
                      </td>
                      {IG_METRIC_FIELDS.map(({ key }) => (
                        <td key={key} className="px-3 py-2 text-right text-slate-300 font-mono">
                          {sums[key] || 0}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold text-pink-300">{pct(sums.dm_reply, sums.dm_send)}%</td>
                      <td className="px-3 py-2 text-right font-bold text-amber-300">{pct(sums.ig_offer, sums.dm_reply)}%</td>
                      <td className="px-3 py-2 text-right font-bold text-green-300">{pct(sums.ig_seiyaku, sums.ig_doin_exec)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
