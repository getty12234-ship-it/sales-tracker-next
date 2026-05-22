'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, upsertDailyMetrics, getWeeklyReview, upsertWeeklyReview } from '@/lib/queries'
import { getWeekDays, formatDateJa } from '@/lib/date-utils'
import { METRIC_FIELDS, METRIC_CATEGORIES } from '@/lib/constants'
import { syncEvents } from './Header'
import { useRef, useCallback } from 'react'
import type { DailyMetrics } from '@/lib/supabase'
import { Download, Upload, HelpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// debounce用タイマー管理
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

// NGの内訳プリセット
const NG_PRESETS = ['金策NG', '既婚NG', '職業NG', 'スタンスNG', '精神NG']
// 無着地の内訳プリセット
const MUCHAKU_PRESETS = ['こだわりが強い', '横槍', '勧誘ブロック', '不安が強い', '今じゃない', '完全副業ニーズ', 'その他']

export function DailyMetricsTable() {
  const { currentMember, currentWeekStart } = useAppState()
  const queryClient = useQueryClient()
  const weekDays = getWeekDays(currentWeekStart)

  // 内訳モーダルの状態
  const [breakdownModal, setBreakdownModal] = useState<'ng' | 'muchaku' | null>(null)

  // 週のデータ取得
  const { data: metricsData = [], isLoading } = useQuery({
    queryKey: ['daily_metrics', currentMember?.id, currentWeekStart],
    queryFn: () => getDailyMetrics(currentMember!.id, weekDays[0], weekDays[6]),
    enabled: !!currentMember,
  })

  // 週次レビュー（内訳モーダルの読み書き用）
  const { data: weeklyReview } = useQuery({
    queryKey: ['weekly_review', currentMember?.id, currentWeekStart],
    queryFn: () => getWeeklyReview(currentMember!.id, currentWeekStart),
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

  // 週次レビュー保存mutation
  const { mutateAsync: saveReview } = useMutation({
    mutationFn: upsertWeeklyReview,
    onSuccess: (data) => {
      queryClient.setQueryData(['weekly_review', currentMember?.id, currentWeekStart], data)
    },
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

  // CSV エクスポート
  const exportCSV = () => {
    const headers = ['日付', ...METRIC_FIELDS.map(f => f.label)]
    const rows = weekDays.map(date => [
      date,
      ...METRIC_FIELDS.map(f => String((metricsMap[date]?.[f.key as keyof DailyMetrics] as number) || 0))
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `daily_${weekDays[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // CSV インポート
  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentMember) return
    const text = await file.text()
    const lines = text.replace(/^﻿/, '').split('\n').filter(l => l.trim())
    if (lines.length < 2) return
    const headerLine = lines[0].split(',')
    const fieldIndexMap: Record<string, number> = {}
    METRIC_FIELDS.forEach(({ key, label }) => {
      const idx = headerLine.indexOf(label)
      if (idx >= 0) fieldIndexMap[key] = idx
    })
    const saves: Promise<any>[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      const date = cols[0]?.trim()
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      const row: any = { member_id: currentMember.id, date }
      METRIC_FIELDS.forEach(({ key }) => {
        const idx = fieldIndexMap[key]
        if (idx !== undefined) row[key] = parseInt(cols[idx]) || 0
      })
      saves.push(save(row))
    }
    await Promise.all(saves)
    queryClient.invalidateQueries({ queryKey: ['daily_metrics', currentMember.id] })
    e.target.value = ''
  }

  // 内訳モーダルの保存
  const handleBreakdownSave = (type: 'ng' | 'muchaku', reasons: { reason: string; count: number }[]) => {
    if (!currentMember) return
    const base = {
      member_id: currentMember.id,
      week_start_date: currentWeekStart,
      main_issue: (weeklyReview?.main_issue as string) || '',
      main_cause: (weeklyReview?.main_cause as string) || '',
      top_action: (weeklyReview?.top_action as string) || '',
      cause_actions: (weeklyReview?.cause_actions as any) || [],
      muchaku_reasons: (weeklyReview?.muchaku_reasons as any) || [],
      ng_reasons: (weeklyReview?.ng_reasons as any) || [],
      doin_muchaku_list: (weeklyReview?.doin_muchaku_list as any) || [],
    }
    if (type === 'ng') {
      saveReview({ ...base, ng_reasons: reasons })
    } else {
      saveReview({ ...base, muchaku_reasons: reasons })
    }
    setBreakdownModal(null)
  }

  return (
    <div className="space-y-2">
      {/* ツールバー */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost" size="sm"
          className="h-7 text-xs text-slate-400 hover:text-slate-200 border border-slate-700"
          onClick={exportCSV}
        >
          <Download className="w-3.5 h-3.5 mr-1" />CSV出力
        </Button>
        <label className="cursor-pointer inline-flex items-center h-7 px-3 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md bg-transparent hover:bg-slate-800/40 transition-colors gap-1">
          <Upload className="w-3.5 h-3.5" />CSV取込
          <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
        </label>
      </div>
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
                  {catFields.map(({ key, label, color }) => {
                    const isNg = key === 'ng'
                    const isMuchaku = key === 'muchaku'
                    return (
                      <tr key={key} className="hover:bg-slate-900/50 transition-colors">
                        <td className="sticky left-0 bg-[#0a0f1e] hover:bg-slate-900/50 px-4 py-1 text-xs text-slate-300 font-medium whitespace-nowrap z-10"
                          style={color ? { color } : {}}>
                          <div className="flex items-center gap-1">
                            <span>{label}</span>
                            {(isNg || isMuchaku) && (
                              <button
                                onClick={() => setBreakdownModal(isNg ? 'ng' : 'muchaku')}
                                className="text-slate-600 hover:text-indigo-400 transition-colors"
                                title={`${label}内訳を入力`}
                              >
                                <HelpCircle className="w-3 h-3" />
                              </button>
                            )}
                          </div>
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
                    )
                  })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 内訳モーダル */}
      {breakdownModal && (
        <BreakdownModal
          type={breakdownModal}
          weekTotal={breakdownModal === 'ng' ? totals.ng || 0 : totals.muchaku || 0}
          initialReasons={
            breakdownModal === 'ng'
              ? ((weeklyReview?.ng_reasons as any) || [])
              : ((weeklyReview?.muchaku_reasons as any) || [])
          }
          presets={breakdownModal === 'ng' ? NG_PRESETS : MUCHAKU_PRESETS}
          onSave={(reasons) => handleBreakdownSave(breakdownModal, reasons)}
          onClose={() => setBreakdownModal(null)}
        />
      )}
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

// NG / 無着地 内訳入力モーダル
function BreakdownModal({
  type,
  weekTotal,
  initialReasons,
  presets,
  onSave,
  onClose,
}: {
  type: 'ng' | 'muchaku'
  weekTotal: number
  initialReasons: { reason: string; count: number }[]
  presets: string[]
  onSave: (reasons: { reason: string; count: number }[]) => void
  onClose: () => void
}) {
  // プリセット + 既存データをマージして初期化
  const buildInitial = () => {
    const map: Record<string, number> = {}
    initialReasons.forEach(r => { map[r.reason] = r.count })
    const rows: { reason: string; count: number }[] = presets.map(p => ({
      reason: p,
      count: map[p] || 0,
    }))
    // プリセット外の既存項目も追加
    initialReasons.forEach(r => {
      if (!presets.includes(r.reason)) rows.push({ reason: r.reason, count: r.count })
    })
    return rows
  }

  const [rows, setRows] = useState(buildInitial)
  const inputTotal = rows.reduce((s, r) => s + r.count, 0)

  const title = type === 'ng' ? 'NG内訳' : '無着地内訳'
  const accentColor = type === 'ng' ? '#fb923c' : '#f87171'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-80 max-w-[95vw]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <span className="text-sm font-semibold text-slate-200">{title}</span>
            <span className="text-xs text-slate-500 ml-2">週計 {weekTotal}件</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内訳入力 */}
        <div className="p-4 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accentColor }} />
              <span className="text-xs text-slate-300 flex-1">{row.reason}</span>
              <Input
                type="number"
                min={0}
                className="bg-slate-950 border-slate-700 text-xs h-7 w-16 text-center"
                value={row.count || ''}
                placeholder="0"
                onChange={e => {
                  const next = [...rows]
                  next[i] = { ...next[i], count: parseInt(e.target.value) || 0 }
                  setRows(next)
                }}
              />
            </div>
          ))}
          {/* 合計表示 */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-500">入力合計</span>
            <span className={`text-sm font-bold ${inputTotal === weekTotal ? 'text-green-400' : inputTotal > weekTotal ? 'text-red-400' : 'text-amber-400'}`}>
              {inputTotal} / {weekTotal}
            </span>
          </div>
        </div>

        {/* フッター */}
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-slate-700 text-slate-400"
            onClick={onClose}>キャンセル</Button>
          <Button size="sm" className="flex-1 h-8 text-xs bg-indigo-600 hover:bg-indigo-500"
            onClick={() => onSave(rows.filter(r => r.count > 0))}>
            施策シートに反映
          </Button>
        </div>
      </div>
    </div>
  )
}
