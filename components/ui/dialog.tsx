'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'

type DialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onOpenChange?.(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogContext = React.createContext<{
  open: boolean
  onOpenChange?: (open: boolean) => void
}>({ open: false })

function DialogTrigger({ children, render }: { children?: React.ReactNode; render?: React.ReactElement }) {
  const { onOpenChange } = React.useContext(DialogContext)
  const renderProps = render?.props as Record<string, unknown> | undefined
  const trigger = render
    ? React.cloneElement(render, {
        onClick: (e: React.MouseEvent) => {
          if (typeof renderProps?.onClick === 'function') renderProps.onClick(e)
          onOpenChange?.(true)
        },
        children: children ?? renderProps?.children,
      } as Record<string, unknown>)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : React.cloneElement(children as React.ReactElement<any>, {
        onClick: (e: React.MouseEvent) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(children as React.ReactElement<any>).props.onClick?.(e)
          onOpenChange?.(true)
        },
      })
  return trigger
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DialogOverlay({ className, ...props }: React.ComponentProps<'div'>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <div
      className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-sm', className)}
      onClick={() => onOpenChange?.(false)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  const { open, onOpenChange } = React.useContext(DialogContext)
  if (!open) return null

  return (
    <>
      <DialogOverlay />
      <div
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-700',
          className
        )}
        onClick={e => e.stopPropagation()}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors"
            onClick={() => onOpenChange?.(false)}
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-4', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-4 flex justify-end gap-2', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-base font-semibold text-slate-200', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-slate-400', className)} {...props} />
}

function DialogClose({ children, ...props }: React.ComponentProps<'button'>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <button onClick={() => onOpenChange?.(false)} {...props}>
      {children}
    </button>
  )
}

export {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogOverlay, DialogPortal,
  DialogTitle, DialogTrigger,
}
