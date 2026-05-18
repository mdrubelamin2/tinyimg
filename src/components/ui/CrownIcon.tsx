import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

export function CrownIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn(
        'h-6 w-6 fill-amber-400 stroke-amber-600 stroke-[1] text-amber-400 drop-shadow-[0_2px_5px_rgba(245,158,11,0.4)]',
        className,
      )}
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      {...props}
    >
      <path
        d='M3 6l3.5 7.5L12 4.5l5.5 9L21 6l-2.5 12 Q12 14.5 5.5 18 L3 6z'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <circle
        className='fill-amber-200 stroke-amber-600 stroke-[0.5]'
        cx='3'
        cy='5'
        r='1'
      />
      <circle
        className='fill-amber-200 stroke-amber-600 stroke-[0.5]'
        cx='12'
        cy='3.5'
        r='1'
      />
      <circle
        className='fill-amber-200 stroke-amber-600 stroke-[0.5]'
        cx='21'
        cy='5'
        r='1'
      />
      <path
        d='M5.5 18 Q12 14.5 18.5 18'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.5'
      />
    </svg>
  )
}
