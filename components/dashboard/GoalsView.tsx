'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getMemberGoals, upsertMemberGoals, type MemberGoalData } from '@/lib/queries'
import { syncEvents } from './Header'
import { useRef, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Pencil, Check } from 'lucide-react'

// ===== 型定義 =====
type GoalItem = { id: string; text: string }
type GoalCategories = {
  time: GoalItem[]
  money: GoalItem[]
  place: GoalItem[]
  relationship: GoalItem[]
  passion: GoalItem[]
}

// ゴールブロック（動的・追加・削除・リネーム可）
type GoalBlock = {
  id: string
  label: string
  emoji: string
  color: string
  borderClass: string
  bgClass: string
  hasDeadline: boolean
  deadline: string
  categories: GoalCategories
  kpis?: Record<string, number> // 目標数値（アポ獲得/アポ実施/面談獲得/面談実施/成約）
}

// ゴールブロックに記入する目標数値KPI
const GOAL_KPIS: { key: string; label: string; color: string }[] = [
  { key: 'apo_get',     label: 'アポ獲得',  color: '#3b82f6' },
  { key: 'apo_exec',    label: 'アポ実施',  color: '#06b6d4' },
  { key: 'mendan_get',  label: '面談獲得',  color: '#6366f1' },
  { key: 'mendan_exec', label: '面談実施',  color: '#818cf8' },
  { key: 'seiyaku',     label: '成約',      color: '#22c55e' },
]

const LIFE_CATEGORIES: { key: keyof GoalCategories; label: string; emoji: string; color: string }[] = [
  { key: 'time',         label: '時間',     emoji: '⏰', color: '#60a5fa' },
  { key: 'money',        label: 'お金',     emoji: '💰', color: '#fbbf24' },
  { key: 'place',        label: '場所',     emoji: '🏠', color: '#34d399' },
  { key: 'relationship', label: '人間関係', emoji: '👥', color: '#f472b6' },
  { key: 'passion',      label: 'やりがい', emoji: '✨', color: '#a78bfa' },
]

// ブロックのカラーテーマプリセット
const BLOCK_THEMES = [
  { color: '#818cf8', borderClass: 'border-indigo-500/40',  bgClass: 'bg-indigo-950/30' },
  { color: '#a78bfa', borderClass: 'border-purple-500/40',  bgClass: 'bg-purple-950/30' },
  { color: '#60a5fa', borderClass: 'border-blue-500/40',    bgClass: 'bg-blue-950/30'   },
  { color: '#34d399', borderClass: 'border-emerald-500/40', bgClass: 'bg-emerald-950/30' },
  { color: '#fbbf24', borderClass: 'border-amber-500/40',   bgClass: 'bg-amber-950/20'  },
  { color: '#f87171', borderClass: 'border-red-500/40',     bgClass: 'bg-red-950/20'    },
  { color: '#fb923c', borderClass: 'border-orange-500/40',  bgClass: 'bg-orange-950/20' },
  { color: '#f472b6', borderClass: 'border-pink-500/40',    bgClass: 'bg-pink-950/20'   },
]

// ===== デフォルトブロック（初期値 / 旧データ移行用） =====
const DEFAULT_BLOCKS: Omit<GoalBlock, 'deadline' | 'categories'>[] = [
  { id: 'longterm',      label: '長期ゴール',            emoji: '🏔️', ...BLOCK_THEMES[0], hasDeadline: true  },
  { id: 'midterm',       label: '中期ゴール',            emoji: '🎯', ...BLOCK_THEMES[1], hasDeadline: true  },
  { id: 'shortterm',     label: '短期ゴール',            emoji: '🚀', ...BLOCK_THEMES[2], hasDeadline: true  },
  { id: 'shortshortterm',label: '短短期ゴール（3ヶ月）', emoji: '⚡', ...BLOCK_THEMES[3], hasDeadline: true  },
  { id: 'nextmonth',     label: '来月の目標',            emoji: '📅', ...BLOCK_THEMES[4], hasDeadline: false },
  { id: 'thismonth',     label: '今月の目標',            emoji: '🔥', ...BLOCK_THEMES[5], hasDeadline: false },
]

// ===== ユーティリティ =====
function uid(): string { return Math.random().toString(36).slice(2, 9) }

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
  } catch { return emptyCategories() }
}

// DB → ブロック配列（旧フォーマット自動移行）
function dbToBlocks(data: MemberGoalData | null | undefined): GoalBlock[] {
  if (!data) {
    return DEFAULT_BLOCKS.map(b => ({ ...b, deadline: '', categories: emptyCategories() }))
  }

  // ★ 新フォーマット（longterm_content に {"__v":2, "blocks":[...]} が入っている）
  try {
    const parsed = JSON.parse(data.longterm_content || '{}')
    if (parsed.__v === 2 && Array.isArray(parsed.blocks)) {
      return parsed.blocks as GoalBlock[]
    }
  } catch { /* fall through */ }

  // 旧フォーマット → 自動移行
  return DEFAULT_BLOCKS.map(b => ({
    ...b,
    deadline: (data as unknown as Record<string, string>)[`${b.id}_deadline`] || '',
    categories: parseCategories((data as unknown as Record<string, string>)[`${b.id}_content`] || ''),
  }))
}

// ブロック配列 → DB（longterm_content に一元保存）
function blocksToDb(blocks: GoalBlock[]): Partial<MemberGoalData> {
  return {
    longterm_content: JSON.stringify({ __v: 2, blocks }),
  }
}

// ===== 新規ブロック追加用テーマ循環 =====
function nextTheme(existingCount: number) {
  return BLOCK_THEMES[existingCount % BLOCK_THEMES.length]
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

  const [blocks, setBlocks] = useState<GoalBlock[]>([])

  useEffect(() => {
    setBlocks(dbToBlocks(goalsData))
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

  const triggerSave = (next: GoalBlock[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(blocksToDb(next)), 600)
  }

  const update = (next: GoalBlock[]) => {
    setBlocks(next)
    triggerSave(next)
  }

  // ── ブロック操作 ──
  const addBlock = () => {
    const theme = nextTheme(blocks.length)
    const newBlock: GoalBlock = {
      id: uid(),
      label: '新しいゴール',
      emoji: '⭐',
      ...theme,
      hasDeadline: true,
      deadline: '',
      categories: emptyCategories(),
    }
    update([newBlock, ...blocks])
  }

  const removeBlock = (blockId: string) => {
    update(blocks.filter(b => b.id !== blockId))
  }

  const moveBlock = (blockId: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === blockId)
    if (idx < 0) return
    const next = [...blocks]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    update(next)
  }

  const updateBlockMeta = (blockId: string, patch: Partial<Pick<GoalBlock, 'label' | 'emoji' | 'hasDeadline' | 'deadline'>>) => {
    const next = blocks.map(b => b.id === blockId ? { ...b, ...patch } : b)
    update(next)
  }

  // 目標数値KPIの更新（0または空は「目標なし」としてキー削除＝—表示）
  const updateBlockKpi = (blockId: string, kpiKey: string, value: number) => {
    const next = blocks.map(b => {
      if (b.id !== blockId) return b
      const kpis = { ...(b.kpis || {}) }
      if (value > 0) kpis[kpiKey] = value
      else delete kpis[kpiKey]
      return { ...b, kpis }
    })
    update(next)
  }

  // ── カテゴリ内アイテム操作 ──
  const addItem = (blockId: string, catKey: keyof GoalCategories) => {
    const next = blocks.map(b => {
      if (b.id !== blockId) return b
      return { ...b, categories: { ...b.categories, [catKey]: [...b.categories[catKey], { id: uid(), text: '' }] } }
    })
    update(next)
  }

  const updateItem = (blockId: string, catKey: keyof GoalCategories, itemId: string, text: string) => {
    const next = blocks.map(b => {
      if (b.id !== blockId) return b
      return { ...b, categories: { ...b.categories, [catKey]: b.categories[catKey].map(it => it.id === itemId ? { ...it, text } : it) } }
    })
    update(next)
  }

  const removeItem = (blockId: string, catKey: keyof GoalCategories, itemId: string) => {
    const next = blocks.map(b => {
      if (b.id !== blockId) return b
      return { ...b, categories: { ...b.categories, [catKey]: b.categories[catKey].filter(it => it.id !== itemId) } }
    })
    update(next)
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: currentMember.color || '#6366f1' }}
          >
            {currentMember.name[0]}
          </div>
          <span className="text-slate-300 font-medium">{currentMember.name} のゴールロードマップ</span>
        </div>
        {/* ★ ブロック追加ボタン */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 gap-1.5"
          onClick={addBlock}
        >
          <Plus className="w-3.5 h-3.5" />
          ブロック追加
        </Button>
      </div>

      {blocks.length === 0 && (
        <div className="text-center py-12 text-slate-600 text-sm">
          「ブロック追加」でゴールを追加しましょう
        </div>
      )}

      {/* ゴールブロック一覧 */}
      {blocks.map((block, idx) => (
        <div key={block.id} className="relative">
          {idx < blocks.length - 1 && (
            <div className="absolute left-[19px] top-full w-0.5 h-4 z-10"
              style={{ background: `${block.color}40` }} />
          )}
          <Card className={`${block.bgClass} border ${block.borderClass}`}>
            <GoalBlockCard
              block={block}
              isFirst={idx === 0}
              isLast={idx === blocks.length - 1}
              onMeta={patch => updateBlockMeta(block.id, patch)}
              onMoveUp={() => moveBlock(block.id, -1)}
              onMoveDown={() => moveBlock(block.id, 1)}
              onRemove={() => removeBlock(block.id)}
              onAddItem={catKey => addItem(block.id, catKey)}
              onUpdateItem={(catKey, itemId, text) => updateItem(block.id, catKey, itemId, text)}
              onRemoveItem={(catKey, itemId) => removeItem(block.id, catKey, itemId)}
              onKpi={(kpiKey, value) => updateBlockKpi(block.id, kpiKey, value)}
            />
          </Card>
        </div>
      ))}
    </div>
  )
}

// ===== ブロックカードコンポーネント =====
type BlockCardProps = {
  block: GoalBlock
  isFirst: boolean
  isLast: boolean
  onMeta: (patch: Partial<Pick<GoalBlock, 'label' | 'emoji' | 'hasDeadline' | 'deadline'>>) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onAddItem: (catKey: keyof GoalCategories) => void
  onUpdateItem: (catKey: keyof GoalCategories, itemId: string, text: string) => void
  onRemoveItem: (catKey: keyof GoalCategories, itemId: string) => void
  onKpi: (kpiKey: string, value: number) => void
}

function GoalBlockCard({ block, isFirst, isLast, onMeta, onMoveUp, onMoveDown, onRemove, onAddItem, onUpdateItem, onRemoveItem, onKpi }: BlockCardProps) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [editingEmoji, setEditingEmoji] = useState(false)
  const [labelInput, setLabelInput] = useState(block.label)
  const [emojiInput, setEmojiInput] = useState(block.emoji)
  const labelRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabelInput(block.label) }, [block.label])
  useEffect(() => { setEmojiInput(block.emoji) }, [block.emoji])

  const commitLabel = () => {
    if (labelInput.trim()) onMeta({ label: labelInput.trim() })
    else setLabelInput(block.label)
    setEditingLabel(false)
  }
  const commitEmoji = () => {
    if (emojiInput.trim()) onMeta({ emoji: emojiInput.trim() })
    else setEmojiInput(block.emoji)
    setEditingEmoji(false)
  }

  return (
    <>
      {/* カードヘッダー */}
      <div className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          {/* 上下移動 */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              className={`text-slate-600 hover:text-slate-300 transition-colors ${isFirst ? 'opacity-20 cursor-not-allowed' : ''}`}
              onClick={onMoveUp} disabled={isFirst}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              className={`text-slate-600 hover:text-slate-300 transition-colors ${isLast ? 'opacity-20 cursor-not-allowed' : ''}`}
              onClick={onMoveDown} disabled={isLast}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 絵文字（クリックで編集） */}
          {editingEmoji ? (
            <input
              ref={emojiRef}
              className="w-10 text-center text-lg bg-slate-800 border border-slate-600 rounded px-1 outline-none"
              value={emojiInput}
              onChange={e => setEmojiInput(e.target.value)}
              onBlur={commitEmoji}
              onKeyDown={e => { if (e.key === 'Enter') commitEmoji() }}
              autoFocus
            />
          ) : (
            <button
              className="text-xl hover:opacity-70 transition-opacity"
              onClick={() => { setEditingEmoji(true); setTimeout(() => emojiRef.current?.focus(), 50) }}
              title="絵文字を変更"
            >
              {block.emoji}
            </button>
          )}

          {/* ラベル（クリックで編集） */}
          {editingLabel ? (
            <input
              ref={labelRef}
              className="flex-1 text-base font-semibold bg-slate-800 border border-slate-600 rounded px-2 py-0.5 outline-none"
              style={{ color: block.color }}
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
              autoFocus
            />
          ) : (
            <button
              className="flex-1 text-base font-semibold text-left flex items-center gap-1.5 group"
              style={{ color: block.color }}
              onClick={() => { setEditingLabel(true); setTimeout(() => labelRef.current?.focus(), 50) }}
            >
              {block.label}
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )}

          {/* 右側アクション */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 期限トグル */}
            <button
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                block.hasDeadline
                  ? 'border-current text-current opacity-80'
                  : 'border-slate-700 text-slate-600 hover:text-slate-400'
              }`}
              style={block.hasDeadline ? { color: block.color, borderColor: `${block.color}60` } : {}}
              onClick={() => onMeta({ hasDeadline: !block.hasDeadline })}
              title="期限フィールドのON/OFF"
            >
              期限
            </button>
            {/* 削除 */}
            <button
              className="text-slate-600 hover:text-red-400 transition-colors p-1"
              onClick={() => { if (confirm(`「${block.label}」を削除しますか？`)) onRemove() }}
              title="このブロックを削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* カードコンテンツ */}
      <div className="px-4 pb-4 space-y-3">
        {/* 期限 */}
        {block.hasDeadline && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 w-10 shrink-0">期限</span>
            <Input
              className="bg-slate-950/60 border-slate-700 text-sm h-9 text-slate-200 placeholder:text-slate-500"
              placeholder="例：R9年6月 / 30歳まで / 2027年末"
              value={block.deadline}
              onChange={e => onMeta({ deadline: e.target.value })}
            />
          </div>
        )}

        {/* 目標数値（アポ獲得/アポ実施/面談獲得/面談実施/成約） */}
        <div className="bg-slate-950/40 rounded-lg px-3 py-2.5">
          <div className="text-sm font-semibold text-slate-300 mb-2">🎯 目標数値</div>
          <div className="grid grid-cols-5 gap-2">
            {GOAL_KPIS.map(k => (
              <div key={k.key}>
                <label className="text-[10px] block mb-1 text-center" style={{ color: k.color }}>{k.label}</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-md px-1 py-1.5 text-sm text-slate-100 text-center outline-none focus:border-slate-500"
                  value={block.kpis?.[k.key] ?? ''}
                  placeholder="—"
                  onChange={e => { const n = Math.floor(Number(e.target.value)); onKpi(k.key, Number.isFinite(n) && n > 0 ? n : 0) }}
                  onFocus={e => e.target.select()}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 5カテゴリ */}
        <div className="space-y-3">
          {LIFE_CATEGORIES.map(cat => {
            const items = block.categories[cat.key]
            return (
              <div key={cat.key} className="bg-slate-950/40 rounded-lg px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: cat.color }}>
                    {cat.emoji} {cat.label}
                  </span>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-slate-500 hover:text-slate-200"
                    onClick={() => onAddItem(cat.key)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-600 pl-1">＋ で追加</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <input
                          className="flex-1 bg-slate-900/60 border border-slate-700/60 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-slate-500 w-full"
                          placeholder="入力..."
                          value={item.text}
                          onChange={e => onUpdateItem(cat.key, item.id, e.target.value)}
                        />
                        <button
                          className="text-slate-600 hover:text-red-400 shrink-0"
                          onClick={() => onRemoveItem(cat.key, item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
