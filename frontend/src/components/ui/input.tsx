import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn('h-11 w-full rounded-lg border border-[#e0dccf] bg-[#fbfaf6] px-3 text-sm text-[#252923] outline-none placeholder:text-[#b8bcb1] focus:border-[#a7654b] focus:ring-2 focus:ring-[#a7654b]/15', className)} {...props} />)
Input.displayName = 'Input'
