'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDownIcon } from 'lucide-react'

const SelectContext = React.createContext<{
  value: string
  onValueChange?: (v: string | null) => void
  open: boolean
  setOpen: (v: boolean) => void
}>({ value: '', open: false, setOpen: () => {} })

function Select({ value = '', onValueChange, children }: {
  value?: string; onValueChange?: (v: string | null) => void; children: React.ReactNode; defaultValue?: string
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={ref} className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<'button'>) {
  const { setOpen, open } = React.useContext(SelectContext)
  return (
    <button
      type="button"
      className={cn('flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 h-9 min-w-0 cursor-pointer hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500', className)}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
      <ChevronDownIcon className={cn('w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
    </button>
  )
}

function SelectValue({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) {
  const { value } = React.useContext(SelectContext)
  return <span className="truncate">{value ? (children ?? value) : <span className="text-slate-500">{placeholder}</span>}</span>
}

function SelectContent({ className, children }: React.ComponentProps<'div'>) {
  const { open } = React.useContext(SelectContext)
  if (!open) return null
  return (
    <div className={cn('absolute top-full left-0 z-50 mt-1 min-w-full rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1 max-h-56 overflow-y-auto', className)}>
      {children}
    </div>
  )
}

function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(SelectContext)
  return (
    <div
      className={cn('px-3 py-2 text-sm cursor-pointer hover:bg-slate-800 text-slate-200', ctx.value === value && 'bg-slate-800 text-indigo-300', className)}
      onClick={() => { ctx.onValueChange?.(value); ctx.setOpen(false) }}
    >
      {children}
    </div>
  )
}

function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1 h-px bg-slate-800', className)} />
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator }
