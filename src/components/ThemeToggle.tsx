import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from '@/components/theme-provider';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Alternar tema" className="hover:bg-primary/10 opacity-0">
        <Sun className="w-5 h-5" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-warning" />
          ) : (
            <Moon className="w-5 h-5 text-muted-foreground" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isDark ? 'Modo Claro' : 'Modo Escuro'}</p>
      </TooltipContent>
    </Tooltip>
  );
};
