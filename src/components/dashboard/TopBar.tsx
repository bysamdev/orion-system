import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const TopBar: React.FC = () => {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar tickets..." 
            className="pl-10 bg-muted border-0"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
        </Button>
        
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Samuel</span>
        </div>
      </div>
    </div>
  );
};
