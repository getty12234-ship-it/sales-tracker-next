'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getMembers, createMember, deleteMember, getSettings, upsertSettings } from '@/lib/queries'
import { DEFAULT_GOALS, MEMBER_COLORS, KPI_SUMMARY } from '@/lib/constants'
import { syncEvents } from './Header'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash2, Settings, Users, Target, Calculator } from 'lucide-react'

export function SettingsView() {
  const { currentMember, setCurrentMember, members: allMembers, setMembers, currentTeam } = useAppState()
  const members = allMembers.filter(m => (m.team || 'top') === currentTeam)
  const queryClient = useQueryClient()

  // 予算自動計算
  const [budget, setBudget] = useState('')
  const [unitPrice, setUnitPrice] = useState('')

  // 目標設定
  const { data: settings } = useQuery({
    queryKey: ['settings', currentMember?.id],
    queryFn: () => getSettings(currentMember!.id),
    enabled: !!currentMember,
  })

  const goals = ((settings?.goals as Record<string, number>) || DEFAULT_GOALS)

  const { mutate: saveGoals } = useMutation({
    mutationFn: ({ goals }: { goals: Record<string, number> }) =>
      upsertSettings(currentMember!.id, goals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', currentMember?.id] })
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
  })

  // メンバー管理
  const [newMemberName, setNewMemberName] = useState('')
  const [selectedColor, setSelectedColor] = useState(MEMBER_COLORS[0])
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)

  const { mutate: addMember } = useMutation({
    mutationFn: () => createMember(newMemberName, selectedColor, currentTeam),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      setMemberDialogOpen(false)
      setNewMemberName('')
    },
  })

  const { mutate: removeMember } = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      if (currentMember) setCurrentMember(null)
    },
  })

  const handleGoalChange = (key: string, value: number) => {
    if (!currentMember) return
    const next = { ...goals, [key]: value }
    saveGoals({ goals: next })
  }

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

      {/* 予算→目標自動計算 */}
      {currentMember && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              予算から目標を自動計算
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 w-20">月間売上目標</label>
                <Input
                  type="number" min={0}
                  className="bg-slate-950 border-slate-700 text-sm h-8 w-28 text-center"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder="例: 100"
                />
                <span className="text-xs text-slate-500">万円</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 w-12">1件単価</label>
                <Input
                  type="number" min={0}
                  className="bg-slate-950 border-slate-700 text-sm h-8 w-28 text-center"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  placeholder="例: 5"
                />
                <span className="text-xs text-slate-500">万円</span>
              </div>
              <Button
                size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                disabled={!budget || !unitPrice}
                onClick={() => {
                  const b = parseFloat(budget), u = parseFloat(unitPrice)
                  if (!b || !u) return
                  const seiyaku = Math.ceil(b / u)
                  const auto: Record<string, number> = {
                    seiyaku,
                    mendan_exec: Math.ceil(seiyaku * 3.5),
                    doin_exec:   Math.ceil(seiyaku * 4),
                    apo_exec:    Math.ceil(seiyaku * 8),
                    offer:       Math.ceil(seiyaku * 5),
                    apo_get:     Math.ceil(seiyaku * 12),
                    post:        Math.ceil(seiyaku * 15),
                    line_exchange: Math.ceil(seiyaku * 20),
                    doin_get:    Math.ceil(seiyaku * 6),
                  }
                  saveGoals({ goals: { ...goals, ...auto } })
                }}
              >
                自動計算して適用
              </Button>
            </div>
            <p className="text-xs text-slate-600">成約数 = 売上目標 ÷ 単価 をもとに各KPIを逆算します</p>
          </CardContent>
        </Card>
      )}

      {/* 目標設定 */}
      {currentMember && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              月間目標 ({currentMember.name})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {KPI_SUMMARY.map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="text-sm text-slate-400 w-28" style={{ color }}>{label}</label>
                <Input
                  type="number"
                  min={0}
                  className="bg-slate-950 border-slate-700 text-sm h-8 w-24 text-center"
                  value={goals[key] ?? DEFAULT_GOALS[key] ?? 0}
                  onChange={e => handleGoalChange(key, parseInt(e.target.value) || 0)}
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
