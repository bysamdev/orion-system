import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TicketRow, UnassignedTicketRow } from './LinhasDeChamado';
import { FiltrosDoPainel } from './useFiltrosDoPainel';

interface AbasDeChamadosProps {
  activeTab: string;
  setActiveTab: (aba: string) => void;
  filtros: FiltrosDoPainel;
  totalNaFila: number;
  onAssume: (id: string) => void;
}

// Fila de espera, meus chamados e todos os chamados, em abas.
export const AbasDeChamados: React.FC<AbasDeChamadosProps> = ({ activeTab, setActiveTab, filtros, totalNaFila, onAssume }) => (
  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
    <div className="flex items-center justify-between">
      <TabsList className="inline-flex">
        <TabsTrigger value="unassigned">
          Fila de Espera ({totalNaFila})
        </TabsTrigger>
        <TabsTrigger value="my-tickets">
          Meus Chamados ({filtros.filteredMyTickets.length})
        </TabsTrigger>
        <TabsTrigger value="all-tickets">
          Todos os Chamados ({filtros.filteredAllTickets.length})
        </TabsTrigger>
      </TabsList>
    </div>

    <TabsContent value="unassigned" className="mt-0">
      <Card className="border-border/50 rounded-xl overflow-hidden bg-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[750px]">
            <TableHeader className="bg-muted/5">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="w-[80px] text-xs font-semibold h-10">Nº</TableHead>
                <TableHead className="text-xs font-semibold h-10">Chamado</TableHead>
                <TableHead className="w-[104px] text-xs font-semibold h-10">Prioridade</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold h-10">Aberto</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold h-10">SLA</TableHead>
                <TableHead className="w-[130px] h-10 text-xs font-semibold text-right pr-6">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtros.filteredUnassignedTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic text-xs">
                    {filtros.temFiltroNaFila
                      ? 'Nenhum chamado encontrado na fila de espera com os filtros aplicados.'
                      : 'Fila limpa! Nenhum chamado aguardando atendimento.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtros.filteredUnassignedTickets.map(t => (
                  <UnassignedTicketRow key={t.id} ticket={t} onAssume={onAssume} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="my-tickets" className="mt-0">
      <Card className="border-border/50 rounded-xl overflow-hidden bg-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[750px]">
            <TableHeader className="bg-muted/5">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="w-[80px] text-xs font-semibold h-10">Nº</TableHead>
                <TableHead className="text-xs font-semibold h-10">Chamado</TableHead>
                <TableHead className="w-[104px] text-xs font-semibold h-10">Prioridade</TableHead>
                <TableHead className="w-[150px] text-xs font-semibold h-10 text-center">Status</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold h-10">Aberto</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold h-10">SLA</TableHead>
                <TableHead className="w-[48px] h-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtros.filteredMyTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic text-xs">
                    Nenhum chamado encontrado nesta categoria.
                  </TableCell>
                </TableRow>
              ) : (
                filtros.filteredMyTickets.map(t => <TicketRow key={t.id} ticket={t} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="all-tickets" className="mt-0">
      <Card className="border-border/50 rounded-xl overflow-hidden bg-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[750px]">
            <TableHeader className="bg-muted/5">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="w-[80px] text-xs font-semibold h-10">Nº</TableHead>
                <TableHead className="text-xs font-semibold h-10">Chamado</TableHead>
                <TableHead className="w-[104px] text-xs font-semibold h-10">Prioridade</TableHead>
                <TableHead className="w-[150px] text-xs font-semibold h-10 text-center">Status</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold h-10">Aberto</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold h-10">SLA</TableHead>
                <TableHead className="w-[48px] h-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtros.filteredAllTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic text-xs">
                    Nenhum chamado ativo encontrado no momento.
                  </TableCell>
                </TableRow>
              ) : (
                filtros.filteredAllTickets.map(t => <TicketRow key={t.id} ticket={t} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
);
