'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

function TooltipProvider({ children }: { children: React.ReactNode; delay?: number }) {
  return <>{children}</>
}

function Tooltip({ children }: { children: React.ReactNode; open?: boolean; defaultOpen?: boolean; onOpenChange?: (v: boolean) => void }) {
  return <>{children}</>
}

function TooltipTrigger({ children, asChild, render }: { children: React.ReactNode; asChild?: boolean; render?: React.ReactElement }) {
  return <>{children}</>
}

function TooltipContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return null // Simplified - tooltip content not rendered in basic impl
}

function TooltipArrow() { return null }

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, TooltipArrow }
