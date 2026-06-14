import React from "react";
import { BellOff } from "lucide-react";

const Notifications = () => {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-white">Notificações</h2>
      </div>

      <div className="flex h-[60vh] shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/10 mb-4">
            <BellOff className="h-10 w-10 text-purple-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">Nenhuma notificação</h3>
          <p className="mb-4 mt-2 text-sm text-gray-400">
            Você não possui novas notificações no momento. Quando houver atualizações em seus tickets ou avisos do sistema, eles aparecerão aqui.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
