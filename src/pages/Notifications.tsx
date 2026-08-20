import React, { useState } from "react";
import { BellOff, CheckCheck, Bell } from "lucide-react";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { NotificationItem } from "@/components/shared/NotificationItem";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";

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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
      <PageHeader
        icon={Bell}
        badge="CENTRAL DE AVISOS"
        title="Notificações"
        description="Histórico de alertas de chamados, prazos de SLA e avisos do sistema."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              onClick={() => markAllAsRead()}
              className="text-xs text-primary border-primary/20 hover:bg-primary/10 rounded-xl"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Marcar todas como lidas
            </Button>
          ) : undefined
        }
      />

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
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
