import React from 'react';
import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTeamWorkload } from '@/hooks/useTechnicianStats';

export type CargaDeTecnico = NonNullable<ReturnType<typeof useTeamWorkload>['data']>[number];

// Carga de trabalho por técnico. Só admin e developer veem.
export const CargaDaEquipe: React.FC<{ teamWorkload: CargaDeTecnico[] }> = ({ teamWorkload }) => (
  <Card className="border-border/50 rounded-xl overflow-hidden bg-card">
    <CardHeader className="px-5 py-4 border-b border-border/40">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div>
          <CardTitle className="text-sm font-semibold text-foreground">Carga de Trabalho da Equipe</CardTitle>
          <CardDescription className="text-xs">Capacidade e pendências em tempo real</CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <Table>
        <TableHeader className="bg-muted/5">
          <TableRow className="hover:bg-transparent border-b border-border/40">
            <TableHead className="w-[300px] text-xs font-semibold h-10 pl-6">Técnico</TableHead>
            <TableHead className="text-xs font-semibold h-10 text-center">Em Aberto</TableHead>
            <TableHead className="text-xs font-semibold h-10 text-center">SLA em Risco</TableHead>
            <TableHead className="text-xs font-semibold h-10 text-center">Resolvidos Hoje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teamWorkload.map(tech => (
            <TableRow key={tech.technician_id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="pl-6 py-3 font-medium text-sm truncate">{tech.technician_name}</TableCell>
              <TableCell className="text-center py-3">
                <Badge variant="outline" className="font-bold">{tech.open_tickets}</Badge>
              </TableCell>
              <TableCell className="text-center py-3">
                {tech.sla_at_risk_tickets > 0 ? (
                  <Badge variant="destructive" className="font-bold">{tech.sla_at_risk_tickets}</Badge>
                ) : (
                  <span className="text-muted-foreground font-medium text-xs">0</span>
                )}
              </TableCell>
              <TableCell className="text-center py-3">
                <span className="text-emerald-500 font-bold">{tech.resolved_today}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
