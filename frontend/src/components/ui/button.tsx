import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'terracotta' }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', ...props }, ref) => <button ref={ref} className={cn('inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a7654b] disabled:pointer-events-none disabled:opacity-50', variant === 'default' && 'bg-[#252923] text-[#f8f6f0] hover:bg-[#394235]', variant === 'outline' && 'border border-[#e0dccf] bg-[#fbfaf6] text-[#252923] hover:bg-[#f1eee5]', variant === 'ghost' && 'text-[#77796f] hover:bg-[#e9e6dc]', variant === 'terracotta' && 'bg-[#a7654b] text-[#f8f6f0] hover:bg-[#8a503b]',
    className)} {...props} />)
Button.displayName = 'Button'
