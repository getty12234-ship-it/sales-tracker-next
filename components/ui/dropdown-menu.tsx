'use client'
import * as React from 'react'
export function DropdownMenu({ children }: { children: React.ReactNode }) { return <>{children}</> }
export function DropdownMenuTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) { return <>{children}</> }
export function DropdownMenuContent({ children, className }: { children: React.ReactNode; className?: string }) { return null }
export function DropdownMenuItem({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) { return null }
export function DropdownMenuSeparator() { return null }
export function DropdownMenuLabel({ children }: { children: React.ReactNode }) { return null }
