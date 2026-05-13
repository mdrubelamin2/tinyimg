import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>

export const Checkbox = ({ checked, className, ...props }: CheckboxProps) => {
  const rootProps = checked === undefined ? props : { checked, ...props }

  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer border-border bg-input text-foreground ring-offset-background focus-visible:ring-ring/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground hover:border-primary/50 h-4 w-4 shrink-0 cursor-pointer rounded-sm border transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      data-state={checked === 'indeterminate' ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
      {...rootProps}
    >
      <CheckboxPrimitive.Indicator className='flex items-center justify-center text-current'>
        {checked === 'indeterminate' ? (
          <Minus className='h-3.5 w-3.5' />
        ) : (
          <Check className='h-3.5 w-3.5' />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
