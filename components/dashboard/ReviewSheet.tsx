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
import { Plus, Trash2 } from 'lucide-react'
import type { DailyMetrics, WeeklyReview } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
    doin_muchaku_list: [] as { date: string; customer: string; closer: string; reason: string }[],
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
        doin_muchaku_list: (review.doin_muchaku_list as any) || [],
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
            {/* 確認数字（変換率） */}
            <div className="pt-2 space-y-1">
              <p className="text-xs text-slate-600 mb-1">確認数字</p>
              {[
                { label: '無着地率',  value: pct(totals.muchaku, totals.apo_exec),  color: '#f87171' },
                { label: 'NG率',      value: pct(totals.ng,      totals.apo_exec),  color: '#fb923c' },
                { label: 'オファー率',value: pct(totals.offer,   totals.apo_exec),  color: '#f59e0b' },
                { label: '成約率',    value: pct(totals.seiyaku, totals.doin_exec), color: '#22c55e' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-0.5">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>{value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 曜日別グラフ */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">曜日別 アポ獲得・動員実施・成約</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {(() => {
              const dayLabels = ['月', '火', '水', '木', '金', '土', '日']
              const chartData = weekDays.map((date, i) => {
                const m = metrics.find(d => d.date === date)
                return {
                  day: dayLabels[i],
                  アポ獲得: m?.apo_get || 0,
                  動員実施: m?.doin_exec || 0,
                  成約: m?.seiyaku || 0,
                }
              })
              return (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }} />
                    <Bar dataKey="アポ獲得" fill="#6366f1" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="動員実施" fill="#8b5cf6" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="成約" fill="#22c55e" radius={[2,2,0,0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )
            })()}
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

        {/* 最多無着地理由（自動計算） */}
        {form.muchaku_reasons.length > 0 && (() => {
          const top = [...form.muchaku_reasons].filter(r => r.count > 0).sort((a, b) => b.count - a.count)[0]
          if (!top) return null
          return (
            <Card className="bg-slate-900 border-amber-800/40 border">
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-amber-400 font-semibold">
                  ⚠️ 最多無着地理由: <span className="text-white">{top.reason}（{top.count}件）</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">↑ この理由への対策を「最重要アクション」に記入してください</div>
              </CardContent>
            </Card>
          )
        })()}

        {/* NG理由 */}
        <ReasonList
          title={`NG理由 (計: ${totals.ng || 0}件)`}
          readOnly={readOnly}
          items={form.ng_reasons}
          onChange={next => !readOnly && debouncedSave({ ng_reasons: next })}
        />

        {/* 動員後無着地リスト */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300">
                動員後無着地リスト ({form.doin_muchaku_list.length}件)
              </CardTitle>
              {!readOnly && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300"
                  onClick={() => !readOnly && debouncedSave({
                    doin_muchaku_list: [...form.doin_muchaku_list, { date: '', customer: '', closer: '', reason: '' }]
                  })}>
                  <Plus className="w-3.5 h-3.5 mr-1" />追加
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {form.doin_muchaku_list.length === 0 && (
              <p className="text-xs text-slate-600">{readOnly ? '（記録なし）' : '追加ボタンで入力'}</p>
            )}
            {form.doin_muchaku_list.map((item, i) => (
              <div key={i} className="flex gap-2 items-center flex-wrap">
                <Input
                  className="bg-slate-950 border-slate-700 text-xs h-7 w-24"
                  value={item.date} readOnly={readOnly} placeholder="日付"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], date: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }}
                />
                <Input
                  className="bg-slate-950 border-slate-700 text-xs h-7 flex-1 min-w-[80px]"
                  value={item.customer} readOnly={readOnly} placeholder="顧客名"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], customer: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }}
                />
                <Input
                  className="bg-slate-950 border-slate-700 text-xs h-7 w-20"
                  value={item.closer} readOnly={readOnly} placeholder="クローザー"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], closer: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }}
                />
                <Input
                  className="bg-slate-950 border-slate-700 text-xs h-7 flex-1 min-w-[80px]"
                  value={item.reason} readOnly={readOnly} placeholder="無着地理由"
                  onChange={e => { if (readOnly) return; const next = [...form.doin_muchaku_list]; next[i] = { ...next[i], reason: e.target.value }; debouncedSave({ doin_muchaku_list: next }) }}
                />
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-400 shrink-0"
                    onClick={() => debouncedSave({ doin_muchaku_list: form.doin_muchaku_list.filter((_, j) => j !== i) })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
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
