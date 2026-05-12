'use client'
import * as React from 'react'
export function Popover({ children }: { children: React.ReactNode }) { return <>{children}</> }
export function PopoverTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) { return <>{children}</> }
export function PopoverContent({ children, className }: { children: React.ReactNode; className?: string }) { return null }
export function PopoverAnchor({ children }: { children: React.ReactNode }) { return <>{children}</> }
