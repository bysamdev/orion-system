import fs from 'fs';

const togglePath = '/Users/sam/Documents/orion-system/src/components/ThemeToggle.tsx';
let toggleContent = `import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from 'next-themes';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="hover:bg-primary/10 opacity-0">
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
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="hover:bg-primary/10"
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
`;
fs.writeFileSync(togglePath, toggleContent, 'utf8');

const appPath = '/Users/sam/Documents/orion-system/src/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

appContent = appContent.replace(
  "import { lazy, Suspense } from 'react';",
  "import { lazy, Suspense } from 'react';\nimport { ThemeProvider } from \"next-themes\";"
);

appContent = appContent.replace(
  "<QueryClientProvider client={queryClient}>",
  "<ThemeProvider attribute=\"class\" defaultTheme=\"system\" enableSystem>\n    <QueryClientProvider client={queryClient}>"
);

appContent = appContent.replace(
  "</QueryClientProvider>",
  "</QueryClientProvider>\n  </ThemeProvider>"
);

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('Update successful');
