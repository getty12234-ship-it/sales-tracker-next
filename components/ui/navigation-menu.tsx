import * as React from 'react'
import { cn } from '@/lib/utils'

function NavigationMenu({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav className={cn('relative', className)} {...props}>{children}</nav>
}
function NavigationMenuList({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('flex gap-1', className)} {...props} />
}
function NavigationMenuItem({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <li {...props}>{children}</li>
}
function NavigationMenuTrigger({ className, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('', className)} {...props} />
}
function NavigationMenuContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />
}
function NavigationMenuLink({ className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={cn('', className)} {...props} />
}
export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink }
