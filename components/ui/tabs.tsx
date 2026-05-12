'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

const TabsContext = React.createContext<{ value: string; onValueChange?: (v: string) => void }>({ value: '' })

function Tabs({ value, defaultValue, onValueChange, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: string; defaultValue?: string; onValueChange?: (v: string) => void }) {
  const [internal, setInternal] = React.useState(defaultValue || '')
  const v = value ?? internal
  return (
    <TabsContext.Provider value={{ value: v, onValueChange: onValueChange ?? setInternal }}>
      <div className={cn('space-y-2', className)} {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800', className)} {...props} />
}

function TabsTrigger({ value, className, ...props }: React.HTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  return (
    <button
      className={cn('flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors', ctx.value === value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800', className)}
      onClick={() => ctx.onValueChange?.(value)}
      {...props}
    />
  )
}

function TabsContent({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null
  return <div className={cn('', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
