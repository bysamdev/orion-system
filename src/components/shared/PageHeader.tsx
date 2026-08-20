import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  icon: React.ElementType;
  badge?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  badge,
  title,
  description,
  actions,
  className,
}) => {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-primary/10 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          {badge && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-semibold uppercase tracking-widest text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground font-medium">
          {description}
        </p>
      </div>

      {actions && (
        <div className="flex items-center gap-3 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};
