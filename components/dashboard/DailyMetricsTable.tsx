'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, upsertDailyMetrics } from '@/lib/queries'
import { getWeekDays, formatDateJa } from '@/lib/date-utils'
import { METRIC_FIELDS, METRIC_CATEGORIES } from '@/lib/constants'
import { syncEvents } from './Header'
import { useRef, useCallback } from 'react'
import type { DailyMetrics } from '@/lib/supabase'

// debounce用タイマー管理
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function DailyMetricsTable() {
  const { currentMember, currentWeekStart } = useAppState()
  const queryClient = useQueryClient()
  const weekDays = getWeekDays(currentWeekStart)

  // 週のデータ取得
  const { data: metricsData = [], isLoading } = useQuery({
    queryKey: ['daily_metrics', currentMember?.id, currentWeekStart],
    queryFn: () => getDailyMetrics(currentMember!.id, weekDays[0], weekDays[6]),
    enabled: !!currentMember,
  })

  // date → DailyMetrics のマップ
  const metricsMap = Object.fromEntries(metricsData.map(m => [m.date, m]))

  // 保存mutation
  const { mutateAsync: save } = useMutation({
    mutationFn: upsertDailyMetrics,
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['daily_metrics', currentMember?.id, currentWeekStart],
        (old: DailyMetrics[] = []) => {
          const idx = old.findIndex(m => m.date === data.date)
          if (idx >= 0) {
            const next = [...old]
            next[idx] = data
            return next
          }
          return [...old, data]
        }
      )
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  // 入力変更ハンドラ（デバウンス付き）
  const handleChange = useCallback((date: string, field: string, value: number) => {
    if (!currentMember) return

    // 楽観的更新: キャッシュをすぐ更新
    queryClient.setQueryData(
      ['daily_metrics', currentMember.id, currentWeekStart],
      (old: DailyMetrics[] = []) => {
        const existing = old.find(m => m.date === date)
        if (existing) {
          return old.map(m => m.date === date ? { ...m, [field]: value } : m)
        }
        return [...old, { member_id: currentMember.id, date, [field]: value } as DailyMetrics]
      }
    )

    // デバウンス保存 (600ms)
    const key = `${currentMember.id}_${date}`
    if (saveTimers.has(key)) clearTimeout(saveTimers.get(key)!)

    syncEvents.emit('saving')
    saveTimers.set(key, setTimeout(async () => {
      const current = (queryClient.getQueryData<DailyMetrics[]>(
        ['daily_metrics', currentMember.id, currentWeekStart]
      ) || []).find(m => m.date === date)

      await save({
        member_id: currentMember.id,
        date,
        post: 0, line_exchange: 0, apo_get: 0, apo_exec: 0, apo_cxl: 0,
        test_close: 0, offer: 0, ng: 0, muchaku: 0,
        doin_get: 0, doin_get_cxl: 0, doin_exec: 0, doin_exec_cxl: 0,
        mendan_get: 0, mendan_exec: 0, seiyaku: 0, cooling_off: 0,
        ...current,
      })
      saveTimers.delete(key)
    }, 600))
  }, [currentMember, currentWeekStart, queryClient, save])

  if (!currentMember) {
    return <div className="text-slate-500 text-sm p-8 text-center">メンバーを選択してください</div>
  }

  if (isLoading) {
    return <div className="text-slate-500 text-sm p-8 text-center">読み込み中...</div>
  }

  // 合計計算
  const totals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    totals[key] = weekDays.reduce((sum, date) => sum + (metricsMap[date]?.[key as keyof DailyMetrics] as number || 0), 0)
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm border-collapse" style={{ minWidth: '720px' }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-slate-950 text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider w-28 z-10">項目</th>
            {weekDays.map(date => (
              <th key={date} className="px-2 py-3 text-center text-xs text-slate-400 font-medium whitespace-nowrap">
                {formatDateJa(date)}
              </th>
            ))}
            <th className="px-3 py-3 text-center text-xs text-indigo-400 font-bold">合計</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_CATEGORIES.map(cat => {
            const catFields = METRIC_FIELDS.filter(f => f.category === cat)
            return (
              <React.Fragment key={cat}>
                {/* カテゴリヘッダー */}
                <tr>
                  <td colSpan={weekDays.length + 2}
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider bg-slate-900 text-slate-500">
                    {cat}
                  </td>
                </tr>
                {catFields.map(({ key, label, color }) => (
                  <tr key={key} className="hover:bg-slate-900/50 transition-colors">
                    <td className="sticky left-0 bg-[#0a0f1e] hover:bg-slate-900/50 px-4 py-1 text-xs text-slate-300 font-medium whitespace-nowrap z-10"
                      style={color ? { color } : {}}>
                      {label}
                    </td>
                    {weekDays.map(date => {
                      const val = (metricsMap[date]?.[key as keyof DailyMetrics] as number) || 0
                      return (
                        <td key={date} className="px-1 py-1">
                          <MetricCell
                            value={val}
                            onChange={v => handleChange(date, key, v)}
                            highlight={key === 'seiyaku' && val > 0}
                          />
                        </td>
                      )
                    })}
                    <td className="px-3 py-1 text-center font-bold text-indigo-300 text-sm">
                      {totals[key] || ''}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 個別の数値入力セル
function MetricCell({
  value,
  onChange,
  highlight,
}: {
  value: number
  onChange: (v: number) => void
  highlight?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={inputRef}
      type="number"
      min={0}
      className={`metric-input ${highlight ? 'text-green-400 font-bold' : ''}`}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      onFocus={e => e.target.select()}
    />
  )
}
