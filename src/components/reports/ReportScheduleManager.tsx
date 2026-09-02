import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Mail, Plus, Trash2, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import {
  useReportSchedules,
  useCreateReportSchedule,
  useToggleReportSchedule,
  useDeleteReportSchedule,
} from '@/hooks/useReportSchedules';

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export const ReportScheduleManager: React.FC = () => {
  const { data: schedules, isLoading } = useReportSchedules();
  const createSchedule = useCreateReportSchedule();
  const toggleSchedule = useToggleReportSchedule();
  const deleteSchedule = useDeleteReportSchedule();

  const [recipientsInput, setRecipientsInput] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('monthly');

  const handleCreate = () => {
    const recipients = recipientsInput
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (recipients.length === 0) return;
    createSchedule.mutate({ recipients, frequency }, {
      onSuccess: () => setRecipientsInput(''),
    });
  };

  return (
    <Card className="border-border/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Agendamento por E-mail</CardTitle>
        </div>
        <CardDescription>
          Envia automaticamente um resumo de chamados (PDF) para os destinatários, na frequência escolhida.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="destinatarios@empresa.com, outro@empresa.com"
            value={recipientsInput}
            onChange={(e) => setRecipientsInput(e.target.value)}
            className="flex-1"
          />
          <Select value={frequency} onValueChange={(v: 'weekly' | 'monthly') => setFrequency(v)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleCreate}
            disabled={createSchedule.isPending || !recipientsInput.trim()}
            className="gap-2"
          >
            {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agendar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : schedules && schedules.length > 0 ? (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/40 bg-muted/20"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{FREQUENCY_LABEL[schedule.frequency]}</Badge>
                    <span className="text-sm font-medium truncate">{schedule.recipients.join(', ')}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Próximo envio: {formatDate(schedule.next_run_at)}
                    {schedule.last_sent_at && ` · Último envio: ${formatDate(schedule.last_sent_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={schedule.is_active}
                    onCheckedChange={(checked) => toggleSchedule.mutate({ id: schedule.id, is_active: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSchedule.mutate(schedule.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum agendamento configurado.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
