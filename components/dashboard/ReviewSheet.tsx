'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyMetrics, getWeeklyReview, upsertWeeklyReview } from '@/lib/queries'
import { getWeekDays, pct } from '@/lib/date-utils'
import { METRIC_FIELDS, METRIC_CATEGORIES, DEFAULT_GOALS } from '@/lib/constants'
import { syncEvents } from './Header'
import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { DailyMetrics, WeeklyReview } from '@/lib/supabase'

interface ReviewSheetProps {
  weekStart?: string   // 省略時はcontextのcurrentWeekStartを使用
  readOnly?: boolean   // 読み取り専用モード
}

export function ReviewSheet({ weekStart: weekStartProp, readOnly = false }: ReviewSheetProps = {}) {
  const { currentMember, currentWeekStart } = useAppState()
  const queryClient = useQueryClient()
  const weekStart = weekStartProp ?? currentWeekStart
  const weekDays = getWeekDays(weekStart)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { data: metrics = [] } = useQuery({
    queryKey: ['daily_metrics', currentMember?.id, weekStart],
    queryFn: () => getDailyMetrics(currentMember!.id, weekDays[0], weekDays[6]),
    enabled: !!currentMember,
  })

  const { data: review } = useQuery({
    queryKey: ['weekly_review', currentMember?.id, weekStart],
    queryFn: () => getWeeklyReview(currentMember!.id, weekStart),
    enabled: !!currentMember,
  })

  const { mutateAsync: save } = useMutation({
    mutationFn: upsertWeeklyReview,
    onSuccess: (data) => {
      queryClient.setQueryData(['weekly_review', currentMember?.id, weekStart], data)
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  // ローカル状態（入力の遅延保存）
  const [form, setForm] = useState({
    main_issue: '',
    main_cause: '',
    top_action: '',
    cause_actions: [] as { action: string; deadline: string }[],
    muchaku_reasons: [] as { reason: string; count: number }[],
    ng_reasons: [] as { reason: string; count: number }[],
  })

  useEffect(() => {
    if (review) {
      setForm({
        main_issue: review.main_issue || '',
        main_cause: review.main_cause || '',
        top_action: review.top_action || '',
        cause_actions: (review.cause_actions as any) || [],
        muchaku_reasons: (review.muchaku_reasons as any) || [],
        ng_reasons: (review.ng_reasons as any) || [],
      })
    }
  }, [review])

  const debouncedSave = (updates: Partial<typeof form>) => {
    if (!currentMember) return
    const next = { ...form, ...updates }
    setForm(next)
    syncEvents.emit('saving')

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save({
        member_id: currentMember.id,
        week_start_date: weekStart,
        ...next,
      })
    }, 800)
  }

  // 週合計
  const totals: Record<string, number> = {}
  METRIC_FIELDS.forEach(({ key }) => {
    totals[key] = metrics.reduce((sum, m) => sum + ((m[key as keyof DailyMetrics] as number) || 0), 0)
  })

  if (!currentMember) {
    return <div className="text-slate-500 text-sm p-8 text-center">メンバーを選択してください</div>
  }

  return (
    <div className={`grid grid-cols-1 xl:grid-cols-3 gap-4 ${readOnly ? 'opacity-80' : ''}`}>
      {/* 左: 週次数字サマリー */}
      <div className="xl:col-span-1 space-y-3">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">
              週次実績
              {readOnly && <span className="ml-2 text-xs text-slate-500 font-normal">（読み取り専用）</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {METRIC_FIELDS.filter(f => ['seiyaku','mendan_exec','doin_exec','apo_exec','offer','apo_get','muchaku','ng'].includes(f.key)).map(({ key, label, color }) => (
              <div key={key} className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-xs text-slate-400" style={color ? { color } : {}}>{label}</span>
                <span className="text-sm font-bold text-slate-200">{totals[key] || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 右: 施策シートフォーム */}
      <div className="xl:col-span-2 space-y-4">
        {/* メイン課題 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">{readOnly ? '先週の' : '今週の'}メイン課題</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">課題</label>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-16 resize-none"
                value={form.main_issue}
                onChange={e => !readOnly && debouncedSave({ main_issue: e.target.value })}
                readOnly={readOnly}
                placeholder={readOnly ? '（記録なし）' : '今週の最大の課題を記入...'}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">原因</label>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-16 resize-none"
                value={form.main_cause}
                onChange={e => !readOnly && debouncedSave({ main_cause: e.target.value })}
                readOnly={readOnly}
                placeholder={readOnly ? '（記録なし）' : '課題の根本原因...'}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">最重要アクション</label>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-12 resize-none"
                value={form.top_action}
                onChange={e => !readOnly && debouncedSave({ top_action: e.target.value })}
                readOnly={readOnly}
                placeholder={readOnly ? '（記録なし）' : '来週最も優先して取り組むこと...'}
              />
            </div>
          </CardContent>
        </Card>

        {/* 原因別アクション */}
        <ActionList
          title="原因別アクションリスト"
          readOnly={readOnly}
          items={form.cause_actions}
          renderItem={(item, i) => (
            <div className="flex gap-2 items-center">
              <Input
                className="bg-slate-950 border-slate-700 text-xs h-7 flex-1"
                value={item.action}
                onChange={e => {
                  if (readOnly) return
                  const next = [...form.cause_actions]
                  next[i] = { ...next[i], action: e.target.value }
                  debouncedSave({ cause_actions: next })
                }}
                readOnly={readOnly}
                placeholder="アクション内容"
              />
              <Input
                className="bg-slate-950 border-slate-700 text-xs h-7 w-28"
                value={item.deadline}
                onChange={e => {
                  if (readOnly) return
                  const next = [...form.cause_actions]
                  next[i] = { ...next[i], deadline: e.target.value }
                  debouncedSave({ cause_actions: next })
                }}
                readOnly={readOnly}
                placeholder="期限"
              />
              {!readOnly && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-400"
                  onClick={() => debouncedSave({ cause_actions: form.cause_actions.filter((_, j) => j !== i) })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
          onAdd={() => !readOnly && debouncedSave({ cause_actions: [...form.cause_actions, { action: '', deadline: '' }] })}
        />

        {/* 無着地理由 */}
        <ReasonList
          title={`無着地理由 (計: ${totals.muchaku || 0}件)`}
          readOnly={readOnly}
          items={form.muchaku_reasons}
          onChange={next => !readOnly && debouncedSave({ muchaku_reasons: next })}
        />

        {/* NG理由 */}
        <ReasonList
          title={`NG理由 (計: ${totals.ng || 0}件)`}
          readOnly={readOnly}
          items={form.ng_reasons}
          onChange={next => !readOnly && debouncedSave({ ng_reasons: next })}
        />
      </div>
    </div>
  )
}

function ActionList({ title, items, renderItem, onAdd, readOnly = false }: {
  title: string
  items: any[]
  renderItem: (item: any, i: number) => React.ReactNode
  onAdd: () => void
  readOnly?: boolean
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300">{title}</CardTitle>
          {!readOnly && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-400 hover:text-indigo-300" onClick={onAdd}>
              <Plus className="w-3.5 h-3.5 mr-1" />追加
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-xs text-slate-600">追加ボタンで入力</p>}
        {items.map((item, i) => renderItem(item, i))}
      </CardContent>
    </Card>
  )
}

function ReasonList({ title, items, onChange, readOnly = false }: {
  title: string
  items: { reason: string; count: number }[]
  onChange: (items: { reason: string; count: number }[]) => void
  readOnly?: boolean
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300">{title}</CardTitle>
          {!readOnly && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-400 hover:text-indigo-300"
              onClick={() => onChange([...items, { reason: '', count: 0 }])}>
              <Plus className="w-3.5 h-3.5 mr-1" />追加
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-xs text-slate-600">{readOnly ? '（記録なし）' : '追加ボタンで入力'}</p>}
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              className="bg-slate-950 border-slate-700 text-xs h-7 flex-1"
              value={item.reason}
              onChange={e => {
                if (readOnly) return
                const next = [...items]
                next[i] = { ...next[i], reason: e.target.value }
                onChange(next)
              }}
              readOnly={readOnly}
              placeholder="理由"
            />
            <Input
              type="number"
              className="bg-slate-950 border-slate-700 text-xs h-7 w-16 text-center"
              value={item.count || ''}
              onChange={e => {
                if (readOnly) return
                const next = [...items]
                next[i] = { ...next[i], count: parseInt(e.target.value) || 0 }
                onChange(next)
              }}
              readOnly={readOnly}
              placeholder="件数"
            />
            {!readOnly && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-400"
                onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
