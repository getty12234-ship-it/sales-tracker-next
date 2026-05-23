'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getMemberGoals, upsertMemberGoals, type MemberGoalData } from '@/lib/queries'
import { syncEvents } from './Header'
import { useRef, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

// ===== 型定義 =====
type GoalItem = { id: string; text: string }
type GoalCategories = {
  time: GoalItem[]
  money: GoalItem[]
  place: GoalItem[]
  relationship: GoalItem[]
  passion: GoalItem[]
}

const LIFE_CATEGORIES: { key: keyof GoalCategories; label: string; emoji: string; color: string }[] = [
  { key: 'time',         label: '時間',     emoji: '⏰', color: '#60a5fa' },
  { key: 'money',        label: 'お金',     emoji: '💰', color: '#fbbf24' },
  { key: 'place',        label: '場所',     emoji: '🏠', color: '#34d399' },
  { key: 'relationship', label: '人間関係', emoji: '👥', color: '#f472b6' },
  { key: 'passion',      label: 'やりがい', emoji: '✨', color: '#a78bfa' },
]

function emptyCategories(): GoalCategories {
  return { time: [], money: [], place: [], relationship: [], passion: [] }
}

function parseCategories(content: string): GoalCategories {
  try {
    const parsed = JSON.parse(content || '{}')
    if (parsed && typeof parsed === 'object' && ('time' in parsed || 'money' in parsed)) {
      return { ...emptyCategories(), ...parsed }
    }
    return emptyCategories()
  } catch {
    return emptyCategories()
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

// ===== ゴール段階定義 =====
const GOAL_LEVELS = [
  { key: 'longterm',      label: '長期ゴール',        emoji: '🏔️', color: '#818cf8', border: 'border-indigo-500/40',  bg: 'bg-indigo-950/30',  hasDeadline: true },
  { key: 'midterm',       label: '中期ゴール',        emoji: '🎯', color: '#a78bfa', border: 'border-purple-500/40',  bg: 'bg-purple-950/30',  hasDeadline: true },
  { key: 'shortterm',     label: '短期ゴール',        emoji: '🚀', color: '#60a5fa', border: 'border-blue-500/40',    bg: 'bg-blue-950/30',    hasDeadline: true },
  { key: 'shortshortterm',label: '短短期ゴール（3ヶ月）', emoji: '⚡', color: '#34d399', border: 'border-emerald-500/40', bg: 'bg-emerald-950/30', hasDeadline: true },
  { key: 'nextmonth',     label: '来月の目標',        emoji: '📅', color: '#fbbf24', border: 'border-amber-500/40',   bg: 'bg-amber-950/20',   hasDeadline: false },
  { key: 'thismonth',     label: '今月の目標',        emoji: '🔥', color: '#f87171', border: 'border-red-500/40',     bg: 'bg-red-950/20',     hasDeadline: false },
] as const

type GoalKey = typeof GOAL_LEVELS[number]['key']

// ===== ローカルstate型 =====
type LocalGoals = Record<GoalKey, { deadline: string; categories: GoalCategories }>

function makeEmptyLocal(): LocalGoals {
  return Object.fromEntries(
    GOAL_LEVELS.map(l => [l.key, { deadline: '', categories: emptyCategories() }])
  ) as LocalGoals
}

function serverToLocal(data: MemberGoalData): LocalGoals {
  const local = makeEmptyLocal()
  for (const level of GOAL_LEVELS) {
    const deadlineKey = `${level.key}_deadline` as keyof MemberGoalData
    const contentKey = `${level.key}_content` as keyof MemberGoalData
    local[level.key] = {
      deadline: (data[deadlineKey] as string) || '',
      categories: parseCategories((data[contentKey] as string) || ''),
    }
  }
  return local
}

function localToServer(local: LocalGoals): Partial<MemberGoalData> {
  const result: Partial<MemberGoalData> = {}
  for (const level of GOAL_LEVELS) {
    const contentKey = `${level.key}_content` as keyof MemberGoalData
    ;(result as any)[contentKey] = JSON.stringify(local[level.key].categories)
    // deadline は hasDeadline=true のゴールのみ送信（DBカラムが存在するもののみ）
    if (level.hasDeadline) {
      const deadlineKey = `${level.key}_deadline` as keyof MemberGoalData
      ;(result as any)[deadlineKey] = local[level.key].deadline
    }
  }
  return result
}

// ===== メインコンポーネント =====
export function GoalsView() {
  const { currentMember } = useAppState()
  const queryClient = useQueryClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { data: goalsData } = useQuery({
    queryKey: ['member_goals', currentMember?.id],
    queryFn: () => getMemberGoals(currentMember!.id),
    enabled: !!currentMember,
  })

  const [local, setLocal] = useState<LocalGoals>(makeEmptyLocal())

  useEffect(() => {
    if (goalsData) setLocal(serverToLocal(goalsData))
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

  const triggerSave = (next: LocalGoals) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(localToServer(next)), 600)
  }

  const updateDeadline = (goalKey: GoalKey, value: string) => {
    const next = { ...local, [goalKey]: { ...local[goalKey], deadline: value } }
    setLocal(next)
    triggerSave(next)
  }

  const addItem = (goalKey: GoalKey, catKey: keyof GoalCategories) => {
    const cats = { ...local[goalKey].categories }
    cats[catKey] = [...cats[catKey], { id: uid(), text: '' }]
    const next = { ...local, [goalKey]: { ...local[goalKey], categories: cats } }
    setLocal(next)
    triggerSave(next)
  }

  const updateItem = (goalKey: GoalKey, catKey: keyof GoalCategories, id: string, text: string) => {
    const cats = { ...local[goalKey].categories }
    cats[catKey] = cats[catKey].map(item => item.id === id ? { ...item, text } : item)
    const next = { ...local, [goalKey]: { ...local[goalKey], categories: cats } }
    setLocal(next)
    triggerSave(next)
  }

  const removeItem = (goalKey: GoalKey, catKey: keyof GoalCategories, id: string) => {
    const cats = { ...local[goalKey].categories }
    cats[catKey] = cats[catKey].filter(item => item.id !== id)
    const next = { ...local, [goalKey]: { ...local[goalKey], categories: cats } }
    setLocal(next)
    triggerSave(next)
  }

  if (!currentMember) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-slate-500 text-sm">メンバーを選択してください</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* メンバー名 */}
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
        const data = local[level.key]
        return (
          <div key={level.key} className="relative">
            {idx < GOAL_LEVELS.length - 1 && (
              <div className="absolute left-[19px] top-full w-0.5 h-4 z-10"
                style={{ background: `${level.color}40` }} />
            )}
            <Card className={`${level.bg} border ${level.border}`}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: level.color }}>
                  <span className="text-base">{level.emoji}</span>
                  {level.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {/* 期限 */}
                {level.hasDeadline && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-8 shrink-0">期限</span>
                    <Input
                      className="bg-slate-950/60 border-slate-700 text-xs h-7 text-slate-200 placeholder:text-slate-600"
                      placeholder="例：R9年6月 / 30歳まで"
                      value={data.deadline}
                      onChange={e => updateDeadline(level.key, e.target.value)}
                    />
                  </div>
                )}

                {/* 5カテゴリ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {LIFE_CATEGORIES.map(cat => {
                    const items = data.categories[cat.key]
                    return (
                      <div key={cat.key} className="bg-slate-950/40 rounded-lg p-2 space-y-1.5">
                        {/* カテゴリヘッダー */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold" style={{ color: cat.color }}>
                            {cat.emoji} {cat.label}
                          </span>
                          <Button
                            variant="ghost" size="icon"
                            className="h-5 w-5 text-slate-600 hover:text-slate-300"
                            onClick={() => addItem(level.key, cat.key)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* 項目リスト */}
                        {items.length === 0 ? (
                          <p className="text-[10px] text-slate-700 text-center py-1">
                            ＋で追加
                          </p>
                        ) : (
                          items.map(item => (
                            <div key={item.id} className="flex items-start gap-1">
                              <Input
                                className="bg-slate-900/80 border-slate-700/50 text-[11px] h-6 text-slate-200 placeholder:text-slate-600 px-1.5 flex-1 min-w-0"
                                placeholder="入力..."
                                value={item.text}
                                onChange={e => updateItem(level.key, cat.key, item.id, e.target.value)}
                              />
                              <button
                                className="text-slate-700 hover:text-red-400 mt-0.5 shrink-0"
                                onClick={() => removeItem(level.key, cat.key, item.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
