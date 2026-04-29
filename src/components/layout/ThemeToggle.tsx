/**
 * ThemeToggle: dark/light mode toggle button.
 */

import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className='text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors duration-200'
      onClick={toggleTheme}
      size='icon'
      variant='ghost'
    >
      {theme === 'dark' ? (
        <Sun
          className='transition-opacity duration-200'
          size={20}
        />
      ) : (
        <Moon
          className='transition-opacity duration-200'
          size={20}
        />
      )}
    </Button>
  )
}
