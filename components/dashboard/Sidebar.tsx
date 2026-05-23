'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Calendar,
  ClipboardList,
  FileText,
  Camera,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Map,
  Users,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'サマリー',       icon: TrendingUp,    exact: true },
  { href: '/dashboard/team',      label: 'チームサマリー', icon: Users },
  { href: '/dashboard/daily',     label: '日別数字',       icon: Calendar },
  { href: '/dashboard/review',    label: '施策シート',     icon: ClipboardList },
  { href: '/dashboard/nippo',     label: '日報',           icon: FileText },
  { href: '/dashboard/instagram', label: 'インスタ',       icon: Camera },
  { href: '/dashboard/goals',     label: 'ゴール',         icon: Map },
  { href: '/dashboard/settings',  label: '設定',           icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'flex flex-col bg-[#060d1f] border-r border-slate-800 transition-all duration-200 shrink-0',
      collapsed ? 'w-14' : 'w-48'
    )}>
      {/* ロゴ */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-slate-200 whitespace-nowrap">Sales Tracker</span>
        )}
      </div>

      {/* ナビ */}
      <nav className="flex-1 py-2 space-y-1 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* 折りたたみボタン */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
