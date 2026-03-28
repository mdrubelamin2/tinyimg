/**
 * ThemeToggle: dark/light mode toggle button.
 */

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';

export const ThemeToggle: React.FC = () => {
  const { resolved, toggleTheme, isPending } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      disabled={isPending}
      className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200 disabled:opacity-50"
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
    >
      {resolved === 'dark' ? (
        <Sun size={20} className="transition-opacity duration-200" />
      ) : (
        <Moon size={20} className="transition-opacity duration-200" />
      )}
    </Button>
  );
};
