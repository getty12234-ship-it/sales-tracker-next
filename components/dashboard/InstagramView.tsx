'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getInstagramAccounts, getInstagramMetrics, getInstagramMonthlyMetrics, upsertInstagramMetrics, createInstagramAccount, updateInstagramAccountStats, deleteInstagramAccount, getSettings } from '@/lib/queries'
import { getWeekDays, formatDateJa, currentYearMonth, pct, cumulativeBudgetTarget, requiredDailyFromNow, passedWorkdays, remainingWorkdays, totalWorkdays } from '@/lib/date-utils'
import { IG_METRIC_FIELDS, IG_STOCK_FIELDS, IG_TRIM_FIELDS, IG_POST_FIELDS, IG_FUNNEL, IG_TREND_LINES, IG_EMPTY_METRICS, IG_DEFAULT_GOALS, IG_KPI_SUMMARY } from '@/lib/constants'
import { syncEvents } from './Header'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Camera, TrendingUp, Download, Table2, Filter, Users, Ban, X, Target } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts'
import type { InstagramMetrics, InstagramAccount } from '@/lib/supabase'

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const num = (v: unknown) => (typeof v === 'number' ? v : parseInt(String(v ?? '')) || 0)

// ホバーで詳細を出すバー
function BarWithTooltip({ tooltip, children }: { tooltip: string; children: React.ReactNode }) {
  return (
    <div className="relative group/bar">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
        opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150
        px-2 py-1 rounded bg-slate-700 border border-slate-600 text-[10px] text-slate-200 whitespace-nowrap shadow-lg">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
      </div>
    </div>
  )
}

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

  // インスタ目標カスタマイズ用に settings を取得
  const { data: settings } = useQuery({
    queryKey: ['settings', currentMember?.id],
    queryFn: () => getSettings(currentMember!.id),
    enabled: !!currentMember,
  })
  const rawGoals = (settings?.goals as Record<string, number>) || {}

  const effectiveAccountId = selectedAccountId || accounts[0]?.id || null
  const effectiveAccount = accounts.find(a => a.id === effectiveAccountId) || null

  const { data: metrics = [] } = useQuery({
    queryKey: ['ig_metrics', effectiveAccountId, currentWeekStart],
    queryFn: () => getInstagramMetrics(effectiveAccountId!, weekDays[0], weekDays[6]),
    enabled: !!effectiveAccountId,
  })
  const metricsMap = Object.fromEntries(metrics.map(m => [m.date, m])) as Record<string, InstagramMetrics>

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

  const ym = currentYearMonth()
  const { data: monthlyMetricsList = [] } = useQuery({
    queryKey: ['ig_monthly_all', accounts.map(a => a.id).join(','), ym],
    queryFn: async () => {
      const results = await Promise.all(accounts.map(acc => getInstagramMonthlyMetrics(acc.id, ym)))
      return accounts.map((acc, i) => ({ account: acc, metrics: results[i] }))
    },
    enabled: accounts.length > 0,
  })

  const { mutate: addAccount, isPending: addingAccount } = useMutation({
    mutationFn: ({ name, url, memberId }: { name: string; url: string; memberId: string }) =>
      createInstagramAccount(name, url, memberId),
    onSuccess: (acc) => {
      queryClient.invalidateQueries({ queryKey: ['ig_accounts'] })
      setSelectedAccountId(acc?.id ?? null)
      setDialogOpen(false); setNewName(''); setNewUrl('')
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`アカウント追加に失敗しました。\n${msg}`)
    },
  })

  // アカウント削除
  const { mutate: removeAccount, isPending: deletingAccount } = useMutation({
    mutationFn: (id: string) => deleteInstagramAccount(id),
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['ig_accounts'] })
      queryClient.invalidateQueries({ queryKey: ['ig_monthly_all'] })
      if (selectedAccountId === deletedId) setSelectedAccountId(null)
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`アカウント削除に失敗しました。\n${msg}`)
    },
  })

  const handleDeleteAccount = (acc: { id: string; name: string }) => {
    if (deletingAccount) return
    if (window.confirm(`「${acc.name}」を削除しますか？\nこのアカウントの数値データもすべて削除され、元に戻せません。`)) {
      removeAccount(acc.id)
    }
  }

  // アカウントの現在の数値（スナップショット：フォロワー/フォロー中/投稿数）
  const [stats, setStats] = useState({ cur_followers: 0, cur_follows: 0, cur_posts: 0 })
  const statsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    setStats({
      cur_followers: effectiveAccount?.cur_followers || 0,
      cur_follows: effectiveAccount?.cur_follows || 0,
      cur_posts: effectiveAccount?.cur_posts || 0,
    })
  }, [effectiveAccountId, effectiveAccount?.cur_followers, effectiveAccount?.cur_follows, effectiveAccount?.cur_posts])

  const { mutate: saveStats } = useMutation({
    mutationFn: (patch: { cur_followers: number; cur_follows: number; cur_posts: number }) =>
      updateInstagramAccountStats(effectiveAccountId!, patch),
    onMutate: () => syncEvents.emit('saving'),
    onSuccess: (updated) => {
      queryClient.setQueryData(['ig_accounts', currentMember?.id], (old: InstagramAccount[] = []) =>
        old.map(a => a.id === updated.id ? updated : a))
      syncEvents.emit('saved'); setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  const handleStat = (key: 'cur_followers' | 'cur_follows' | 'cur_posts', value: number) => {
    const next = { ...stats, [key]: value }
    setStats(next)
    if (statsTimer.current) clearTimeout(statsTimer.current)
    statsTimer.current = setTimeout(() => saveStats(next), 600)
  }

  // 数値フィールド入力（フロー/ストック共通）
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
      const current = (queryClient.getQueryData<InstagramMetrics[]>(['ig_metrics', effectiveAccountId, currentWeekStart]) || []).find(m => m.date === date)
      await save({ account_id: effectiveAccountId, date, ...IG_EMPTY_METRICS, ...current })
      saveTimers.delete(key)
    }, 600))
  }, [effectiveAccountId, currentWeekStart, queryClient, save])

  // ブロックチェック（boolean・即保存）
  const handleBlockToggle = useCallback(async (date: string, checked: boolean) => {
    if (!effectiveAccountId) return
    queryClient.setQueryData(
      ['ig_metrics', effectiveAccountId, currentWeekStart],
      (old: InstagramMetrics[] = []) => {
        const existing = old.find(m => m.date === date)
        if (existing) return old.map(m => m.date === date ? { ...m, blocked: checked } : m)
        return [...old, { account_id: effectiveAccountId, date, blocked: checked } as InstagramMetrics]
      }
    )
    const current = (queryClient.getQueryData<InstagramMetrics[]>(['ig_metrics', effectiveAccountId, currentWeekStart]) || []).find(m => m.date === date)
    syncEvents.emit('saving')
    await save({ account_id: effectiveAccountId, date, ...IG_EMPTY_METRICS, ...current, blocked: checked })
  }, [effectiveAccountId, currentWeekStart, queryClient, save])

  if (!currentMember) {
    return <div className="text-slate-500 text-sm p-8 text-center">メンバーを選択してください</div>
  }

  // ===== 今週の集計 =====
  const flowSum = (key: string) => weekDays.reduce((s, d) => s + num(metricsMap[d]?.[key as keyof InstagramMetrics]), 0)
  const stockLatest = (key: string) => { for (let i = weekDays.length - 1; i >= 0; i--) { const v = num(metricsMap[weekDays[i]]?.[key as keyof InstagramMetrics]); if (v > 0) return v } return 0 }
  const stockFirst = (key: string) => { for (let i = 0; i < weekDays.length; i++) { const v = num(metricsMap[weekDays[i]]?.[key as keyof InstagramMetrics]); if (v > 0) return v } return 0 }
  const stockDelta = (key: string) => { const l = stockLatest(key), f = stockFirst(key); return (l > 0 && f > 0) ? l - f : 0 }
  const blockedDays = weekDays.filter(d => metricsMap[d]?.blocked).length

  // 現在値はアカウントのスナップショット優先（無ければ日次の最新値）
  const followerLatest = effectiveAccount?.cur_followers || stockLatest('followers')
  const followerDelta = stockDelta('followers')
  const followLatest = effectiveAccount?.cur_follows || stockLatest('follows')
  const dmSendWeek = flowSum('dm_send')
  const seiyakuWeek = flowSum('ig_seiyaku')
  const funnelTop = flowSum('dm_send')
  const overallRate = pct(seiyakuWeek, dmSendWeek)

  // 選択アカウントの当月推移
  const selectedMonthMetrics = monthlyMetricsList.find(m => m.account.id === effectiveAccountId)?.metrics || []
  const trendData = buildWeeklyTrend(selectedMonthMetrics)
  const followerSeries = [...selectedMonthMetrics]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(m => ({ d: m.date.slice(5).replace('-', '/'), フォロワー: num(m.followers), フォロー: num(m.follows) }))
    .filter(p => p.フォロワー > 0 || p.フォロー > 0)

  // 入力テーブルのグループ定義
  const tableGroups = [
    { group: 'ストック（累計）', stock: true, fields: [{ key: 'follows', label: 'フォロー', color: '#ec4899' }, { key: 'followers', label: 'フォロワー', color: '#f472b6' }] },
    { group: '投稿', stock: false, fields: IG_POST_FIELDS },
    { group: '削り', stock: false, fields: IG_TRIM_FIELDS },
    { group: '商談フロー', stock: false, fields: IG_FUNNEL.map(({ key, label, color }) => ({ key, label, color })) },
  ]

  return (
    <div className="space-y-4">
      {/* アカウント選択 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Camera className="w-4 h-4 text-pink-400" />
            <span className="text-xs text-slate-400">アカウント:</span>
            {accounts.map(acc => {
              const active = effectiveAccountId === acc.id
              return (
                <span
                  key={acc.id}
                  className={`inline-flex items-center rounded-full text-xs font-medium transition-colors ${
                    active ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <button onClick={() => setSelectedAccountId(acc.id)} className="pl-3 pr-1.5 py-1">
                    {acc.name}
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(acc)}
                    className={`mr-1 rounded-full p-0.5 ${active ? 'hover:bg-black/25 text-white/80' : 'hover:bg-red-500/20 text-slate-500 hover:text-red-400'}`}
                    title="このアカウントを削除"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 text-xs text-pink-400 hover:text-pink-300" />}>
                <Plus className="w-3.5 h-3.5 mr-1" />追加
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
                <DialogHeader><DialogTitle className="text-slate-200">アカウント追加</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input className="bg-slate-950 border-slate-700 text-sm" placeholder="アカウント名" value={newName} onChange={e => setNewName(e.target.value)} />
                  <Input className="bg-slate-950 border-slate-700 text-sm" placeholder="Instagram URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
                  <Button className="w-full bg-pink-600 hover:bg-pink-700" onClick={() => addAccount({ name: newName.trim(), url: newUrl.trim(), memberId: currentMember.id })} disabled={!newName.trim() || addingAccount}>{addingAccount ? '追加中...' : '追加'}</Button>
                </div>
              </DialogContent>
            </Dialog>
            {effectiveAccount?.url && (
              <a href={effectiveAccount.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] text-slate-500 hover:text-pink-400 underline underline-offset-2">プロフィールを開く ↗</a>
            )}
          </div>
        </CardContent>
      </Card>

      {!effectiveAccountId ? (
        <Card className="bg-slate-900 border-slate-800 border-dashed">
          <CardContent className="py-10">
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-pink-600/15 flex items-center justify-center mx-auto">
                <Camera className="w-7 h-7 text-pink-400" />
              </div>
              <div>
                <h3 className="text-slate-100 font-bold text-base">Instagramアカウントを追加して計測を開始</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  アカウントを追加すると、フォロワー推移、集客 → DM → アポ → 成約までのファネル、アクション量グラフ、日次入力テーブルがすべて使えます。
                </p>
              </div>
              <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />アカウントを追加
              </Button>
            </div>
            <div className="mt-8 max-w-lg mx-auto space-y-1.5 opacity-50 select-none pointer-events-none">
              <div className="text-[10px] text-slate-500 text-center mb-2 tracking-wider">― 計測されるファネル ―</div>
              {IG_FUNNEL.map(({ key, label, color, rateLabel }, i) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-16 text-xs shrink-0" style={{ color }}>{label}</span>
                  <div className="flex-1 h-4 bg-slate-800/60 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${100 - i * 11}%`, background: `${color}55` }} />
                  </div>
                  <span className="w-12 text-right text-[10px] text-slate-600 shrink-0">{rateLabel}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 現在の数値（アカウントごと・プロフィール最新値） */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-pink-400" />現在の数値
                <span className="text-[11px] font-normal text-slate-500">{effectiveAccount?.name} のプロフィール最新値を記入</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                {([
                  { key: 'cur_followers', label: 'フォロワー', color: '#f472b6' },
                  { key: 'cur_follows', label: 'フォロー中', color: '#ec4899' },
                  { key: 'cur_posts', label: '投稿数', color: '#a78bfa' },
                ] as const).map(f => (
                  <div key={f.key}>
                    <label className="text-[11px] block mb-1" style={{ color: f.color }}>{f.label}</label>
                    <input
                      type="number" min={0} inputMode="numeric"
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-base font-bold text-slate-100 outline-none focus:border-slate-500"
                      value={stats[f.key] || ''}
                      placeholder="0"
                      onChange={e => handleStat(f.key, parseInt(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ヘッドライン */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="bg-slate-900 border-slate-800 ring-1 ring-pink-500/30">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1"><Users className="w-3 h-3" />フォロワー</div>
                <div className="text-2xl font-bold text-pink-400">{followerLatest.toLocaleString()}</div>
                <div className={`text-[11px] font-bold ${followerDelta > 0 ? 'text-green-400' : followerDelta < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                  {followerDelta > 0 ? `＋${followerDelta} 純増` : followerDelta < 0 ? `${followerDelta} 純減` : '増減なし'}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-3">
                <div className="text-[11px] text-slate-500 mb-1">フォロー中</div>
                <div className="text-2xl font-bold text-rose-300">{followLatest.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-3">
                <div className="text-[11px] text-slate-500 mb-1">DM送信（週計）</div>
                <div className="text-2xl font-bold text-blue-400">{dmSendWeek}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-3">
                <div className="text-[11px] text-slate-500 mb-1">成約（週計）</div>
                <div className="text-2xl font-bold text-green-400">{seiyakuWeek}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-3">
                <div className="text-[11px] text-slate-500 mb-1">全体成約率</div>
                <div className="text-2xl font-bold text-pink-400">{overallRate}%</div>
              </CardContent>
            </Card>
            <Card className={`bg-slate-900 border-slate-800 ${blockedDays > 0 ? 'ring-1 ring-red-500/40' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1"><Ban className="w-3 h-3" />ブロック</div>
                <div className={`text-2xl font-bold ${blockedDays > 0 ? 'text-red-400' : 'text-slate-300'}`}>{blockedDays}<span className="text-sm font-normal text-slate-500">日</span></div>
              </CardContent>
            </Card>
          </div>

          {/* 月間目標進捗（KPIごとのバー：達成率・ペース・予算） */}
          <IgGoalProgress
            account={effectiveAccount}
            monthMetrics={selectedMonthMetrics}
            ym={ym}
            rawGoals={rawGoals}
          />

          {/* ファネル（今週） */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Filter className="w-4 h-4 text-pink-400" />ファネル（今週・転換率）
                <span className="text-[11px] font-normal text-slate-500">DM送信を出発点(100%)として、各段にどれだけ残って到達したか</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {IG_FUNNEL.map(({ key, label, rateLabel, color }, i) => {
                const val = flowSum(key)
                const prev = i === 0 ? 0 : flowSum(IG_FUNNEL[i - 1].key)
                const stepRate = i === 0 ? null : pct(val, prev)
                const reachRate = funnelTop > 0 ? Math.round((val / funnelTop) * 100) : 0
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-16 text-xs shrink-0" style={{ color }}>{label}</span>
                    <div className="flex-1 min-w-0">
                      <BarWithTooltip tooltip={stepRate === null ? `出発点：DM送信 ${val}件（ここを100%として下に向かって絞られていく）` : `${rateLabel} ${stepRate}%（直前段 ${prev} → ${val}）／ DM送信からの到達率 ${reachRate}%`}>
                        <div className="w-full h-5 bg-slate-800/60 rounded overflow-hidden cursor-default">
                          <div className="h-full rounded transition-all" style={{ width: `${Math.max(reachRate, val > 0 ? 4 : 0)}%`, background: `${color}99` }} />
                        </div>
                      </BarWithTooltip>
                    </div>
                    <span className="w-10 text-right text-sm font-bold shrink-0" style={{ color }}>{val}</span>
                    <span className="w-24 text-right text-[11px] shrink-0">
                      {stepRate === null ? <span className="text-slate-600">出発点</span> : (
                        <span className={stepRate >= 50 ? 'text-green-400' : stepRate >= 25 ? 'text-amber-400' : 'text-red-400'}>{rateLabel} {stepRate}%</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* グラフ2枚 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* フォロワー数の推移（当月・日次） */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-pink-400" />フォロワー数の推移（{ym.replace('-', '年')}月）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {followerSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={followerSeries}>
                      <defs>
                        <linearGradient id="igFollowerFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f472b6" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} />
                      <Area type="monotone" dataKey="フォロワー" stroke="#f472b6" strokeWidth={2} fill="url(#igFollowerFill)" dot={{ r: 2, fill: '#f472b6' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-slate-600 text-xs">フォロワー数を入力するとグラフが表示されます</div>
                )}
              </CardContent>
            </Card>

            {/* アクション量の週別推移 */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-pink-400" />アクション量の週別推移（{ym.replace('-', '年')}月）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trendData}>
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      {IG_TREND_LINES.map(({ key, label, color }) => (
                        <Line key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-slate-600 text-xs">データを入力するとグラフが表示されます</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* メトリクス入力テーブル */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm border-collapse" style={{ minWidth: '760px' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 bg-slate-950 text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider w-28 z-10">項目</th>
                  {weekDays.map(date => (
                    <th key={date} className="px-2 py-3 text-center text-xs text-slate-400 font-medium whitespace-nowrap">{formatDateJa(date)}</th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs text-pink-400 font-bold">合計/最新</th>
                </tr>
              </thead>
              <tbody>
                {tableGroups.map(({ group, fields, stock }) => (
                  <FieldGroup key={group} group={group} fields={fields} stock={stock} weekDays={weekDays} metricsMap={metricsMap} onChange={handleChange} colSpan={weekDays.length + 2} stockLatest={stockLatest} />
                ))}
                {/* ブロックチェック行 */}
                <tr>
                  <td colSpan={weekDays.length + 2} className="sticky left-0 bg-slate-950/80 px-4 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">アカウント状態</td>
                </tr>
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="sticky left-0 bg-[#0a0f1e] hover:bg-slate-900/50 px-4 py-1 text-xs text-slate-300 font-medium z-10 whitespace-nowrap">
                    <Ban className="inline w-3 h-3 mr-1 text-red-400 align-middle" />ブロック
                  </td>
                  {weekDays.map(date => (
                    <td key={date} className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-red-500 cursor-pointer"
                        checked={!!metricsMap[date]?.blocked}
                        onChange={e => handleBlockToggle(date, e.target.checked)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1 text-center font-bold text-red-300 text-sm">{blockedDays || ''}{blockedDays ? '日' : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 月間アカウント別サマリー */}
          {monthlyMetricsList.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-pink-400" />月間アカウント別サマリー（{ym.replace('-', '年')}月）
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-200 border border-slate-700"
                    onClick={() => exportMonthlyCsv(monthlyMetricsList, ym)}>
                    <Download className="w-3.5 h-3.5 mr-1" />CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-2 text-slate-500 font-semibold whitespace-nowrap sticky left-0 bg-slate-900 z-10">アカウント</th>
                      {IG_METRIC_FIELDS.map(({ key, label, stock }) => (
                        <th key={key} className="px-3 py-2 text-right text-slate-500 font-semibold whitespace-nowrap">{label}{stock ? '※' : ''}</th>
                      ))}
                      <th className="px-3 py-2 text-right text-pink-400 font-semibold whitespace-nowrap">DM返信率</th>
                      <th className="px-3 py-2 text-right text-violet-400 font-semibold whitespace-nowrap">アポ率</th>
                      <th className="px-3 py-2 text-right text-green-400 font-semibold whitespace-nowrap">成約率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyMetricsList.map(({ account, metrics }) => {
                      const v = monthAgg(metrics)
                      return (
                        <tr key={account.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                          <td className="px-4 py-2 font-semibold text-slate-200 sticky left-0 bg-slate-900 z-10 whitespace-nowrap">{account.name}</td>
                          {IG_METRIC_FIELDS.map(({ key }) => (
                            <td key={key} className="px-3 py-2 text-right text-slate-300 font-mono">{v[key] || 0}</td>
                          ))}
                          <td className="px-3 py-2 text-right font-bold text-pink-300">{pct(v.dm_reply, v.dm_send)}%</td>
                          <td className="px-3 py-2 text-right font-bold text-violet-300">{pct(v.ig_apo_get, v.ig_offer)}%</td>
                          <td className="px-3 py-2 text-right font-bold text-green-300">{pct(v.ig_seiyaku, v.ig_doin_exec)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-[10px] text-slate-600">※ フォロー/フォロワーは累計値のため月末最新値を表示（合計ではありません）</div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ===== 月間目標進捗（KPIごとのバー：達成率・ペース・予算） =====
function IgGoalProgress({
  account, monthMetrics, ym, rawGoals,
}: {
  account: InstagramAccount | null
  monthMetrics: InstagramMetrics[]
  ym: string
  rawGoals: Record<string, number>
}) {
  if (!account) return null
  const totals = monthAgg(monthMetrics)
  const passed = passedWorkdays(ym)
  const remaining = remainingWorkdays(ym)

  // 目標・予算の解決ロジック（カスタム > デフォルト）
  const igGoal = (key: string): number => {
    const customKey = `ig_${key}`
    if (rawGoals[customKey] !== undefined && rawGoals[customKey] > 0) return rawGoals[customKey]
    return IG_DEFAULT_GOALS[key] || 0
  }
  const igBudget = (key: string): number => {
    const customKey = `b_ig_${key}`
    if (rawGoals[customKey] !== undefined && rawGoals[customKey] > 0) return rawGoals[customKey]
    return igGoal(key)
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
          <Target className="w-4 h-4 text-pink-400" />月間目標進捗（{ym.replace('-', '年')}月）
          <span className="text-[11px] font-normal text-slate-500">{account.name} ・ 経過 {passed}日 / 残り {remaining}日</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {IG_KPI_SUMMARY.map(({ key, label, color, important }) => {
            const val = totals[key] || 0
            const goal = igGoal(key)
            const budget = igBudget(key)
            const budgetPaceTarget = budget > 0 ? cumulativeBudgetTarget(budget, ym) : 0
            const goalPaceTarget = goal > 0 ? cumulativeBudgetTarget(goal, ym) : 0
            return (
              <IgKpiCard
                key={key}
                label={label}
                value={val}
                goal={goal}
                budget={budget}
                color={color}
                important={important}
                budgetPaceTarget={budgetPaceTarget}
                goalPaceTarget={goalPaceTarget}
              />
            )
          })}
        </div>
        <div className="mt-3 text-[10px] text-slate-600 leading-relaxed">
          💡 目標は設定画面の「インスタの予算・目標設定」でカスタマイズ可。未設定なら公式運用ルール基準（1アカ：投稿30/月・DM900/月・アポ獲得10/月・成約1/月）。<br />
          🟡今日の予算ライン／🩵今日の目標ライン＝今日ここまで到達しておきたい位置。実績フィルが線を越えていればペース通り。
        </div>
      </CardContent>
    </Card>
  )
}

// KPIカード（1本バー＋予算ペース線＋目標ペース線。その他の獲得方法と同じ仕組み）
function IgKpiCard({
  label, value, goal, budget, color, important, budgetPaceTarget, goalPaceTarget,
}: {
  label: string; value: number; goal: number; budget: number; color: string; important: boolean
  budgetPaceTarget: number; goalPaceTarget: number
}) {
  const scaleMax = Math.max(goal, budget, value, 1)
  const actualPct = Math.min(100, (value / scaleMax) * 100)
  const budgetLine = budget > 0 ? Math.min(100, (budgetPaceTarget / scaleMax) * 100) : null
  const goalLine = goal > 0 ? Math.min(100, (goalPaceTarget / scaleMax) * 100) : null
  const onBudgetPace = budgetPaceTarget <= 0 || value >= budgetPaceTarget
  const hitTarget = value >= (budget || goal) && (budget || goal) > 0
  const fillColor = hitTarget ? '#22c55e' : onBudgetPace ? color : '#ef4444'

  return (
    <Card className={`bg-slate-950/40 border-slate-800 ${important ? 'ring-1 ring-indigo-500/30' : ''}`}>
      <CardContent className="p-3">
        <div className="text-xs text-slate-500 mb-1 truncate">{label}</div>
        <div className="flex items-baseline justify-between mb-2.5">
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          <div className="text-right text-xs leading-tight">
            {budget > 0 && <div className="text-amber-400">予算{budget}</div>}
            {goal > 0 && <div className="text-cyan-400/80">目標{goal}</div>}
          </div>
        </div>

        {/* 1本のバー：実績フィル＋予算ペース線（amber）＋目標ペース線（cyan） */}
        <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${actualPct}%`, background: fillColor }} />
          {budgetLine !== null && (
            <div className="absolute top-0 h-full w-[2px] bg-amber-400 z-10" style={{ left: `calc(${budgetLine}% - 1px)` }}
              title={`今日までに到達しておきたい（予算ペース）: ${Math.round(budgetPaceTarget * 10) / 10}`} />
          )}
          {goalLine !== null && (
            <div className="absolute top-0 h-full w-[2px] bg-cyan-400 z-10" style={{ left: `calc(${goalLine}% - 1px)` }}
              title={`今日までに到達しておきたい（目標ペース）: ${Math.round(goalPaceTarget * 10) / 10}`} />
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: fillColor }} />実績</span>
          {budget > 0 && <span className="flex items-center gap-1"><span className="inline-block w-[2px] h-2.5 bg-amber-400" />今日の予算ライン</span>}
          {goal > 0 && <span className="flex items-center gap-1"><span className="inline-block w-[2px] h-2.5 bg-cyan-400" />今日の目標ライン</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// 月間集計（ストック=最新 / フロー=合計）
function monthAgg(metrics: InstagramMetrics[]): Record<string, number> {
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date))
  const out: Record<string, number> = {}
  IG_METRIC_FIELDS.forEach(({ key, stock }) => {
    if (stock) {
      let latest = 0
      for (let i = sorted.length - 1; i >= 0; i--) { const x = num(sorted[i][key as keyof InstagramMetrics]); if (x > 0) { latest = x; break } }
      out[key] = latest
    } else {
      out[key] = metrics.reduce((s, m) => s + num(m[key as keyof InstagramMetrics]), 0)
    }
  })
  return out
}

function exportMonthlyCsv(list: { account: { name: string }; metrics: InstagramMetrics[] }[], ym: string) {
  const headers = ['アカウント', ...IG_METRIC_FIELDS.map(f => f.label + (f.stock ? '(累計)' : '')), 'DM返信率', 'アポ率', '成約率']
  const rows = list.map(({ account, metrics }) => {
    const v = monthAgg(metrics)
    return [account.name, ...IG_METRIC_FIELDS.map(f => String(v[f.key])), `${pct(v.dm_reply, v.dm_send)}%`, `${pct(v.ig_apo_get, v.ig_offer)}%`, `${pct(v.ig_seiyaku, v.ig_doin_exec)}%`]
  })
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `ig_${ym}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// 入力テーブルのグループ
function FieldGroup({
  group, fields, stock, weekDays, metricsMap, onChange, colSpan, stockLatest,
}: {
  group: string
  fields: { key: string; label: string; color: string }[]
  stock?: boolean
  weekDays: string[]
  metricsMap: Record<string, InstagramMetrics>
  onChange: (date: string, field: string, value: number) => void
  colSpan: number
  stockLatest: (key: string) => number
}) {
  return (
    <>
      <tr>
        <td colSpan={colSpan} className="sticky left-0 bg-slate-950/80 px-4 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{group}</td>
      </tr>
      {fields.map(({ key, label, color }) => {
        const total = stock ? stockLatest(key) : weekDays.reduce((sum, date) => sum + num(metricsMap[date]?.[key as keyof InstagramMetrics]), 0)
        return (
          <tr key={key} className="hover:bg-slate-900/50 transition-colors">
            <td className="sticky left-0 bg-[#0a0f1e] hover:bg-slate-900/50 px-4 py-1 text-xs text-slate-300 font-medium z-10 whitespace-nowrap">
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: color }} />{label}
            </td>
            {weekDays.map(date => (
              <td key={date} className="px-1 py-1">
                <input
                  type="number" min={0} className="metric-input"
                  value={num(metricsMap[date]?.[key as keyof InstagramMetrics]) || ''}
                  placeholder="0"
                  onChange={e => onChange(date, key, parseInt(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                />
              </td>
            ))}
            <td className={`px-3 py-1 text-center font-bold text-sm ${stock ? 'text-pink-200' : 'text-pink-300'}`} title={stock ? '最新値' : '週合計'}>
              {total || ''}
            </td>
          </tr>
        )
      })}
    </>
  )
}

// 当月の日次データを週（月曜起点）でまとめる
function buildWeeklyTrend(metrics: InstagramMetrics[]) {
  const weekMap = new Map<string, Record<string, number>>()
  const order: string[] = []
  metrics.forEach(m => {
    const [y, mo, d] = m.date.split('-').map(Number)
    const date = new Date(y, mo - 1, d)
    const day = date.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(date.getDate() + diff)
    const key = `${monday.getMonth() + 1}/${monday.getDate()}週`
    if (!weekMap.has(key)) { weekMap.set(key, {}); order.push(key) }
    const existing = weekMap.get(key)!
    IG_TREND_LINES.forEach(({ key: field }) => {
      existing[field] = (existing[field] || 0) + num(m[field as keyof InstagramMetrics])
    })
  })
  return order.map(week => ({ week, ...weekMap.get(week)! }))
}
