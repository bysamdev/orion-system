import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface EmptyStateAction {
  /** Button label */
  label: string;
  /** Internal route (uses react-router Link) */
  href?: string;
  /** Click handler (used when href is not provided) */
  onClick?: () => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
}

interface EmptyStateProps {
  /** Lucide icon to display */
  icon?: LucideIcon;
  /** Main heading */
  title: string;
  /** Supporting description */
  description?: string;
  /** Optional CTA button */
  action?: EmptyStateAction;
  /** Additional class names for the wrapper */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * EmptyState — consistent empty list/search/filter placeholder.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={InboxIcon}
 *   title="Nenhum chamado encontrado"
 *   description="Tente ajustar os filtros ou crie um novo chamado."
 *   action={{ label: "Novo chamado", href: "/novo-ticket" }}
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: { wrapper: 'py-8 gap-2', icon: 'w-8 h-8', title: 'text-sm', desc: 'text-xs' },
    md: { wrapper: 'py-12 gap-3', icon: 'w-10 h-10', title: 'text-base', desc: 'text-sm' },
    lg: { wrapper: 'py-16 gap-4', icon: 'w-12 h-12', title: 'text-lg', desc: 'text-sm' },
  }[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizeClasses.wrapper,
        className,
      )}
      role="status"
      aria-label={title}
    >
      {Icon && (
        <div className="rounded-full bg-muted/50 p-3">
          <Icon className={cn(sizeClasses.icon, 'text-muted-foreground/40')} strokeWidth={1.5} />
        </div>
      )}

      <div className="space-y-1">
        <p className={cn('font-semibold text-foreground/80', sizeClasses.title)}>{title}</p>
        {description && (
          <p className={cn('text-muted-foreground max-w-xs mx-auto', sizeClasses.desc)}>
            {description}
          </p>
        )}
      </div>

      {action && (
        action.href ? (
          <Button asChild variant={action.variant ?? 'outline'} size="sm" className="mt-1">
            <Link to={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button
            variant={action.variant ?? 'outline'}
            size="sm"
            className="mt-1"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  );
};
