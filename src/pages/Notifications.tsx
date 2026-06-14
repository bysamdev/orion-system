import React, { useState } from "react";
import { BellOff, MessageSquare, CheckCheck } from "lucide-react";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Notifications = () => {
  const navigate = useNavigate();
  const { all, unread, isLoading, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  const displayNotifications = filter === 'unread' ? unread : all;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Notificações</h2>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllAsRead()}
            className="text-xs text-primary border-primary/20 hover:bg-primary/10"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-border/40 pb-4 mb-4">
        <Button
          variant={filter === 'unread' ? 'default' : 'ghost'}
          onClick={() => setFilter('unread')}
          className="rounded-full"
        >
          Não lidas ({unreadCount})
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          onClick={() => setFilter('all')}
          className="rounded-full"
        >
          Todas
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : displayNotifications.length === 0 ? (
        <div className="flex h-[40vh] shrink-0 items-center justify-center rounded-xl border border-border/40 bg-card/50 backdrop-blur-md shadow-sm">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
              <BellOff className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhuma notificação</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              {filter === 'unread'
                ? 'Você não possui notificações não lidas no momento.'
                : 'Não há histórico de notificações para a sua conta.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayNotifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={cn(
                "w-full text-left p-4 rounded-xl transition-colors border",
                notification.is_read
                  ? "bg-card border-border/40 hover:bg-muted/50"
                  : "bg-primary/5 border-primary/20 hover:bg-primary/10"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "p-3 rounded-full mt-1",
                    notification.is_read ? "bg-muted" : "bg-primary/10"
                  )}
                >
                  <MessageSquare
                    className={cn(
                      "w-5 h-5",
                      notification.is_read ? "text-muted-foreground" : "text-primary"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={cn(
                        "text-base font-semibold truncate",
                        notification.is_read ? "text-foreground/80" : "text-foreground"
                      )}
                    >
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <span className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground break-words mb-2">
                    {notification.message}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground/70">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
