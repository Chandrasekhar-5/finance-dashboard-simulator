import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', ...props }, ref) => <button ref={ref} className={cn('inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50', variant === 'default' && 'bg-brand text-white hover:bg-blue-700', variant === 'outline' && 'border border-slate-200 bg-white text-ink hover:bg-slate-50', variant === 'ghost' && 'text-muted hover:bg-slate-100', className)} {...props} />)
Button.displayName = 'Button'
