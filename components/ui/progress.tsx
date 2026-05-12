import * as React from 'react'
import { cn } from '@/lib/utils'

function Progress({ className, value = 0, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: number }) {
  return (
    <div className={cn('w-full h-2 bg-slate-800 rounded-full overflow-hidden', className)} {...props}>
      <div
        className="h-full bg-indigo-500 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export { Progress }
