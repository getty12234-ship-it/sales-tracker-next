'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, ReactNode } from 'react'
import { AppContext } from '@/lib/store'
import type { Member } from '@/lib/supabase'
import { today, getWeekStart, currentYearMonth } from '@/lib/date-utils'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30, // 30秒
        retry: 2,
      },
    },
  }))

  // グローバルステート
  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(today()))
  const [currentYM, setCurrentYM] = useState(currentYearMonth())
  const [currentDate, setCurrentDate] = useState(today())
  const [members, setMembers] = useState<Member[]>([])

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
      }}>
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  )
}
