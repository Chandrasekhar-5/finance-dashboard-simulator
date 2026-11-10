import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <section className={cn('rounded-2xl border border-[#e7e3d9] bg-[#fbfaf6] shadow-[0_1px_3px_rgba(37,41,35,.05)]', className)} {...props} /> }
