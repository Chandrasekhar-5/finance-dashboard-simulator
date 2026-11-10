import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn('h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-blue-100', className)} {...props} />)
Input.displayName = 'Input'
