'use client'
// グローバルステート管理（Zustandなしのシンプルなコンテキスト）

import { createContext, useContext } from 'react'
import type { Member } from './supabase'
import { today, getWeekStart, currentYearMonth } from './date-utils'

export type AppState = {
  // 選択中のメンバー
  currentMember: Member | null
  setCurrentMember: (m: Member | null) => void

  // 選択中の週（月曜日のYYYY-MM-DD）
  currentWeekStart: string
  setCurrentWeekStart: (w: string) => void

  // 選択中の月（YYYY-MM）
  currentYearMonth: string
  setCurrentYearMonth: (ym: string) => void

  // 選択中の日
  currentDate: string
  setCurrentDate: (d: string) => void

  // メンバー一覧
  members: Member[]
  setMembers: (members: Member[]) => void
}

export const AppContext = createContext<AppState>({
  currentMember: null,
  setCurrentMember: () => {},
  currentWeekStart: getWeekStart(today()),
  setCurrentWeekStart: () => {},
  currentYearMonth: currentYearMonth(),
  setCurrentYearMonth: () => {},
  currentDate: today(),
  setCurrentDate: () => {},
  members: [],
  setMembers: () => {},
})

export const useAppState = () => useContext(AppContext)
