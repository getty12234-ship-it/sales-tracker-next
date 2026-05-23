'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, ReactNode, useEffect } from 'react'
import { AppContext } from '@/lib/store'
import type { Member } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { today, getWeekStart, currentYearMonth } from '@/lib/date-utils'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30,
        retry: 2,
      },
    },
  }))

  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(today()))
  const [currentYM, setCurrentYM] = useState(currentYearMonth())
  const [currentDate, setCurrentDate] = useState(today())
  const [members, setMembers] = useState<Member[]>([])
  const [currentTeam, setCurrentTeam] = useState<'top' | 'second' | 'third'>('top')
  const [isAdmin, setIsAdmin] = useState(false)
  const [authMemberId, setAuthMemberId] = useState<string | null>(null)

  // ログイン中ユーザーの st_members レコードを読み込む
  const loadUserMember = async (userId: string) => {
    const { data } = await supabase
      .from('st_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      setAuthMemberId(data.id)
      setIsAdmin(data.is_admin ?? false)
      if (!data.is_admin) {
        // 一般メンバー: 自分のメンバーを自動セット
        setCurrentMember(data)
        setCurrentTeam((data.team as 'top' | 'second' | 'third') || 'top')
      }
      // 管理者は Header の既存ロジックでメンバー選択
    }
  }

  useEffect(() => {
    // 初回: 現在のセッションを確認
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) loadUserMember(user.id)
    })

    // セッション変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserMember(session.user.id)
      } else {
        setCurrentMember(null)
        setIsAdmin(false)
        setAuthMemberId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{
        currentMember,
        setCurrentMember,
        currentWeekStart,
        setCurrentWeekStart,
        currentYearMonth: currentYM,
        setCurrentYearMonth: setCurrentYM,
        currentDate,
        setCurrentDate,
        members,
        setMembers,
        currentTeam,
        setCurrentTeam,
        isAdmin,
        setIsAdmin,
        authMemberId,
        setAuthMemberId,
      }}>
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  )
}
