import React from 'react';
import { MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  size?: 'sm' | 'default';
  className?: string;
}

// Canônico: antes reimplementado quase linha a linha em
// NotificationsPopover.tsx (dentro do popover do sino) e Notifications.tsx
// (página /notificacoes), variando só padding/tamanho de ícone/texto.
export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
  size = 'default',
  className,
}) => {
  const isSm = size === 'sm';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left transition-colors',
        isSm
          ? 'p-3 rounded-lg border-b border-border last:border-b-0'
          : 'p-4 rounded-xl border',
        notification.is_read
          ? isSm ? 'bg-background hover:bg-muted/50' : 'bg-card border-border/40 hover:bg-muted/50'
          : isSm ? 'bg-primary/5 hover:bg-primary/10' : 'bg-primary/5 border-primary/20 hover:bg-primary/10',
        className
      )}
    >
      <div className={cn('flex items-start', isSm ? 'gap-3' : 'gap-4')}>
        <div
          className={cn(
            'rounded-full flex-shrink-0',
            isSm ? 'p-2' : 'p-3 mt-1',
            notification.is_read ? 'bg-muted' : 'bg-primary/10'
          )}
        >
          <MessageSquare
            className={cn(
              isSm ? 'w-4 h-4' : 'w-5 h-5',
              notification.is_read ? 'text-muted-foreground' : 'text-primary'
            )}
          />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className={cn('flex items-center gap-2', !isSm && 'mb-1')}>
            <p
              className={cn(
                isSm ? 'text-sm font-medium truncate flex-1 min-w-0' : 'text-base font-semibold truncate',
                notification.is_read
                  ? isSm ? 'text-muted-foreground' : 'text-foreground/80'
                  : 'text-foreground'
              )}
            >
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className={cn('bg-primary rounded-full flex-shrink-0', isSm ? 'w-2 h-2' : 'w-2.5 h-2.5')} />
            )}
          </div>
          <p
            className={cn(
              'text-muted-foreground break-words',
              isSm ? 'text-xs line-clamp-2 mt-0.5' : 'text-sm mb-2'
            )}
          >
            {notification.message}
          </p>
          <p className={cn('text-muted-foreground/70', isSm ? 'text-xs mt-1' : 'text-xs font-medium')}>
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </div>
    </button>
  );
};
