'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getMembers, createMember, deleteMember, getSettings, upsertSettings } from '@/lib/queries'
import { DEFAULT_GOALS, MEMBER_COLORS, KPI_SUMMARY } from '@/lib/constants'
import { extractBudgets } from '@/lib/supabase'
import { syncEvents } from './Header'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash2, Users, Target, Wallet } from 'lucide-react'

export function SettingsView() {
  const { currentMember, setCurrentMember, members: allMembers, setMembers, currentTeam } = useAppState()
  const members = allMembers.filter(m => (m.team || 'top') === currentTeam)
  const queryClient = useQueryClient()

  // 目標・予算設定
  const { data: settings } = useQuery({
    queryKey: ['settings', currentMember?.id],
    queryFn: () => getSettings(currentMember!.id),
    enabled: !!currentMember,
  })

  const rawGoals = (settings?.goals as Record<string, number>) || {}
  const goals = { ...DEFAULT_GOALS, ...rawGoals }
  const budgets = extractBudgets(rawGoals)

  // ローカル予算入力（1つのカードで管理）
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>({})

  // settingsが変わったらlocalBudgetsを同期
  // (useEffect使わず、未入力ならDBの値を使う)
  const getBudgetVal = (key: string) => {
    if (key in localBudgets) return localBudgets[key]
    return budgets[key] > 0 ? String(budgets[key]) : ''
  }

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: ({ goals, budgets }: { goals: Record<string, number>; budgets: Record<string, number> }) =>
      upsertSettings(currentMember!.id, goals, budgets),
    onMutate: () => syncEvents.emit('saving'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', currentMember?.id] })
      // チームサマリーで使う全員設定キャッシュも更新
      queryClient.invalidateQueries({ queryKey: ['all_members_settings'] })
      setLocalBudgets({})
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  // 目標のみ保存（予算は変更しない）
  const { mutate: saveGoalsOnly } = useMutation({
    mutationFn: (newGoals: Record<string, number>) =>
      upsertSettings(currentMember!.id, newGoals),
    onMutate: () => syncEvents.emit('saving'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', currentMember?.id] })
      queryClient.invalidateQueries({ queryKey: ['all_members_settings'] })
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  const handleSave = () => {
    if (!currentMember) return
    // localBudgets または DB 値から予算を確定
    const finalBudgets: Record<string, number> = {}
    const finalGoals: Record<string, number> = {}
    KPI_SUMMARY.forEach(({ key }) => {
      const bStr = getBudgetVal(key)
      const b = parseFloat(bStr) || 0
      finalBudgets[key] = b
      // 目標 = 予算 × 1.2（小数点以下切り上げ）
      finalGoals[key] = b > 0 ? Math.ceil(b * 1.2) : (DEFAULT_GOALS[key] || 0)
    })
    saveSettings({ goals: finalGoals, budgets: finalBudgets })
  }

  // メンバー管理
  const [newMemberName, setNewMemberName] = useState('')
  const [selectedColor, setSelectedColor] = useState(MEMBER_COLORS[0])
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)

  const { mutate: addMember } = useMutation({
    mutationFn: () => createMember(newMemberName, selectedColor, currentTeam),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      setMemberDialogOpen(false)
      setNewMemberName('')
    },
  })

  const { mutate: removeMember } = useMutation({
    mutationFn: deleteMember,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      // 削除したメンバーが選択中だった場合のみnullに（他は維持）
      if (currentMember?.id === deletedId) setCurrentMember(null)
    },
  })

  return (
    <div className="max-w-2xl space-y-6">
      {/* メンバー管理 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              メンバー管理
            </CardTitle>
            <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
              <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-400 hover:text-indigo-300" />}>
                <Plus className="w-3.5 h-3.5 mr-1" />追加
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-slate-200">メンバー追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    className="bg-slate-950 border-slate-700 text-sm"
                    placeholder="名前"
                    value={newMemberName}
                    onChange={e => setNewMemberName(e.target.value)}
                  />
                  <div>
                    <p className="text-xs text-slate-500 mb-2">カラー</p>
                    <div className="flex gap-2 flex-wrap">
                      {MEMBER_COLORS.map(c => (
                        <button
                          key={c}
                          className={`w-7 h-7 rounded-full transition-transform ${selectedColor === c ? 'scale-125 ring-2 ring-white' : ''}`}
                          style={{ background: c }}
                          onClick={() => setSelectedColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    style={{ background: selectedColor }}
                    onClick={() => addMember()}
                    disabled={!newMemberName.trim()}
                  >
                    追加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: m.color || '#6366f1' }}>
                  {m.name[0]}
                </div>
                <span className="text-sm text-slate-200">{m.name}</span>
                {currentMember?.id === m.id && (
                  <Badge variant="outline" className="text-xs border-indigo-600 text-indigo-400">選択中</Badge>
                )}
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-slate-500 hover:text-red-400"
                onClick={() => {
                  if (confirm(`${m.name}を削除しますか？\n（関連データも全て削除されます）`)) {
                    removeMember(m.id)
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-xs text-slate-600">メンバーを追加してください</p>
          )}
        </CardContent>
      </Card>

      {/* 予算・目標設定 */}
      {currentMember && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                予算・目標設定 ({currentMember.name})
              </CardTitle>
              <Button
                size="sm"
                className="h-7 bg-amber-600 hover:bg-amber-500 text-white text-xs"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3">
              予算を入力すると、目標（予算×1.2）が自動計算されます。
            </p>
            {/* ヘッダー行 */}
            <div className="grid grid-cols-3 gap-2 mb-2 px-1">
              <span className="text-xs text-slate-500">KPI</span>
              <span className="text-xs text-slate-500 text-center">予算（絶対達成）</span>
              <span className="text-xs text-slate-500 text-center">目標（予算×1.2）</span>
            </div>
            {/* KPI 行 */}
            <div className="space-y-2">
              {KPI_SUMMARY.map(({ key, label, color }) => {
                const bStr = getBudgetVal(key)
                const b = parseFloat(bStr) || 0
                const computedGoal = b > 0 ? Math.ceil(b * 1.2) : (goals[key] || 0)
                return (
                  <div key={key} className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-sm" style={{ color }}>{label}</label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      className="bg-slate-950 border-slate-700 text-sm h-8 text-center"
                      value={bStr}
                      onChange={e => setLocalBudgets(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-base font-bold text-slate-200">{computedGoal}</span>
                      <span className="text-xs text-slate-500">/ 月</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 目標のみ手動設定（予算未設定の場合のフォールバック） */}
      {currentMember && Object.values(budgets).every(v => v === 0) && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              目標のみ設定（予算未設定時）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">予算が未設定の場合、個別に目標を設定できます。</p>
            {KPI_SUMMARY.map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="text-sm text-slate-400 w-28" style={{ color }}>{label}</label>
                <Input
                  type="number"
                  min={0}
                  className="bg-slate-950 border-slate-700 text-sm h-8 w-24 text-center"
                  value={goals[key] ?? DEFAULT_GOALS[key] ?? 0}
                  onChange={e => {
                    const next = { ...goals, [key]: parseInt(e.target.value) || 0 }
                    saveGoalsOnly(next)
                  }}
                />
                <span className="text-xs text-slate-600">/ 月</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
