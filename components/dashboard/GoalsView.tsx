'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getMemberGoals, upsertMemberGoals, type MemberGoalData } from '@/lib/queries'
import { syncEvents } from './Header'
import { useRef, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

// ゴール段階定義
const GOAL_LEVELS = [
  {
    key: 'longterm',
    label: '長期ゴール',
    emoji: '🏔️',
    color: '#818cf8',
    border: 'border-indigo-500/40',
    bg: 'bg-indigo-950/30',
    hasDeadline: true,
    hint: '例：30歳まで / 週30時間・月収80万円',
  },
  {
    key: 'midterm',
    label: '中期ゴール',
    emoji: '🎯',
    color: '#a78bfa',
    border: 'border-purple-500/40',
    bg: 'bg-purple-950/30',
    hasDeadline: true,
    hint: '例：R9年6月まで / 週50時間・月収60万円',
  },
  {
    key: 'shortterm',
    label: '短期ゴール',
    emoji: '🚀',
    color: '#60a5fa',
    border: 'border-blue-500/40',
    bg: 'bg-blue-950/30',
    hasDeadline: true,
    hint: '例：R8年11月まで / 月収40万円・成約2件',
  },
  {
    key: 'shortshortterm',
    label: '短短期ゴール（3ヶ月）',
    emoji: '⚡',
    color: '#34d399',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/30',
    hasDeadline: true,
    hint: '例：〇〇年〇月まで / 月収20万円・成約2件・アポ50件',
  },
  {
    key: 'nextmonth',
    label: '来月の目標',
    emoji: '📅',
    color: '#fbbf24',
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/20',
    hasDeadline: false,
    hint: '例：成約1件・アポ40件・動員8件',
  },
  {
    key: 'thismonth',
    label: '今月の目標',
    emoji: '🔥',
    color: '#f87171',
    border: 'border-red-500/40',
    bg: 'bg-red-950/20',
    hasDeadline: false,
    hint: '例：成約1件・アポ40件・動員8件',
  },
] as const

type GoalKey = typeof GOAL_LEVELS[number]['key']

const EMPTY_GOALS: MemberGoalData = {
  longterm_deadline: '',
  longterm_content: '',
  midterm_deadline: '',
  midterm_content: '',
  shortterm_deadline: '',
  shortterm_content: '',
  shortshortterm_deadline: '',
  shortshortterm_content: '',
  nextmonth_content: '',
  thismonth_content: '',
}

export function GoalsView() {
  const { currentMember } = useAppState()
  const queryClient = useQueryClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { data: goalsData } = useQuery({
    queryKey: ['member_goals', currentMember?.id],
    queryFn: () => getMemberGoals(currentMember!.id),
    enabled: !!currentMember,
  })

  // ローカル編集状態
  const [local, setLocal] = useState<MemberGoalData>(EMPTY_GOALS)

  // サーバーデータをローカルに反映
  useEffect(() => {
    if (goalsData) {
      setLocal({
        longterm_deadline: goalsData.longterm_deadline ?? '',
        longterm_content: goalsData.longterm_content ?? '',
        midterm_deadline: goalsData.midterm_deadline ?? '',
        midterm_content: goalsData.midterm_content ?? '',
        shortterm_deadline: goalsData.shortterm_deadline ?? '',
        shortterm_content: goalsData.shortterm_content ?? '',
        shortshortterm_deadline: goalsData.shortshortterm_deadline ?? '',
        shortshortterm_content: goalsData.shortshortterm_content ?? '',
        nextmonth_content: goalsData.nextmonth_content ?? '',
        thismonth_content: goalsData.thismonth_content ?? '',
      })
    }
  }, [goalsData])

  const { mutate: save } = useMutation({
    mutationFn: (data: Partial<MemberGoalData>) => upsertMemberGoals(currentMember!.id, data),
    onMutate: () => syncEvents.emit('saving'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member_goals', currentMember?.id] })
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  const handleChange = (field: keyof MemberGoalData, value: string) => {
    if (!currentMember) return
    const next = { ...local, [field]: value }
    setLocal(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(next), 600)
  }

  if (!currentMember) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-slate-500 text-sm">メンバーを選択してください</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* メンバー名表示 */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: currentMember.color || '#6366f1' }}
        >
          {currentMember.name[0]}
        </div>
        <span className="text-slate-300 font-medium">{currentMember.name} のゴールロードマップ</span>
      </div>

      {/* ゴール段階カード */}
      {GOAL_LEVELS.map((level, idx) => {
        const contentKey = `${level.key}_content` as keyof MemberGoalData
        const deadlineKey = `${level.key}_deadline` as keyof MemberGoalData

        return (
          <div key={level.key} className="relative">
            {/* 縦ライン（最後以外） */}
            {idx < GOAL_LEVELS.length - 1 && (
              <div className="absolute left-[19px] top-full w-0.5 h-4 z-10"
                style={{ background: `${level.color}40` }} />
            )}

            <Card className={`${level.bg} border ${level.border}`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: level.color }}>
                  <span className="text-base">{level.emoji}</span>
                  {level.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {level.hasDeadline && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-10 shrink-0">期限</span>
                    <Input
                      className="bg-slate-950/60 border-slate-700 text-xs h-7 text-slate-200 placeholder:text-slate-600"
                      placeholder="例：R9年6月 / 30歳まで"
                      value={local[deadlineKey]}
                      onChange={e => handleChange(deadlineKey, e.target.value)}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  {level.hasDeadline && (
                    <span className="text-xs text-slate-500 w-10 shrink-0 pt-1.5">目標</span>
                  )}
                  <Textarea
                    className="bg-slate-950/60 border-slate-700 text-xs text-slate-200 placeholder:text-slate-600 resize-none min-h-[64px]"
                    placeholder={level.hint}
                    value={local[contentKey]}
                    onChange={e => handleChange(contentKey, e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
