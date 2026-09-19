import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltrosDoPainel } from './useFiltrosDoPainel';

export const FiltrosAvancados: React.FC<{ filtros: FiltrosDoPainel }> = ({ filtros: f }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/20 rounded-xl border border-border/40 animate-in fade-in slide-in-from-top-2">
    <div className="space-y-1.5 text-left">
      <label className="text-xs font-medium text-muted-foreground ml-1">Prioridade</label>
      <Select value={f.priorityFilter} onValueChange={f.setPriorityFilter}>
        <SelectTrigger className="bg-background/50 border-border/40">
          <SelectValue placeholder="Todas as Prioridades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Prioridades</SelectItem>
          <SelectItem value="urgent" className="text-destructive font-bold">Urgente</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="low">Baixa</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1.5 text-left">
      <label className="text-xs font-medium text-muted-foreground ml-1">Status</label>
      <Select value={f.statusFilter} onValueChange={f.setStatusFilter}>
        <SelectTrigger className="bg-background/50 border-border/40">
          <SelectValue placeholder="Todos os Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Status</SelectItem>
          <SelectItem value="open">Aberto</SelectItem>
          <SelectItem value="in-progress">Em Atendimento</SelectItem>
          <SelectItem value="awaiting-customer">Aguardando Cliente</SelectItem>
          <SelectItem value="resolved">Resolvido</SelectItem>
          <SelectItem value="closed">Concluído</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1.5 text-left">
      <label className="text-xs font-medium text-muted-foreground ml-1">Categoria</label>
      <Select value={f.categoryFilter} onValueChange={f.setCategoryFilter}>
        <SelectTrigger className="bg-background/50 border-border/40">
          <SelectValue placeholder="Todas as Categorias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Categorias</SelectItem>
          <SelectItem value="Sistema">Sistemas Corporativos</SelectItem>
          <SelectItem value="Hardware">Hardware / Equipamentos</SelectItem>
          <SelectItem value="Acesso">Acessos e Contas</SelectItem>
          <SelectItem value="Dúvida">Dúvidas Técnicas</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1.5 text-left">
      <label className="text-xs font-medium text-muted-foreground ml-1">Status SLA</label>
      <Select value={f.slaFilter} onValueChange={f.setSlaFilter}>
        <SelectTrigger className="bg-background/50 border-border/40">
          <SelectValue placeholder="Todos os SLAs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os SLAs</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="attention" className="text-warning font-semibold">Em Atenção</SelectItem>
          <SelectItem value="breached" className="text-destructive font-bold">Vencido</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1.5 text-left lg:col-span-2">
      <label className="text-xs font-medium text-muted-foreground ml-1">Cliente / Empresa</label>
      <div className="relative">
        <Input
          placeholder="Filtrar por nome da empresa..."
          value={f.companyFilter === 'all' ? '' : f.companyFilter}
          onChange={(e) => f.setCompanyFilter(e.target.value || 'all')}
          className="bg-background/50 border-border/40"
        />
      </div>
    </div>

    <div className="lg:col-span-3 flex justify-end pt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={f.limparFiltros}
        className="text-xs font-medium text-muted-foreground hover:text-primary"
      >
        Limpar Filtros
      </Button>
    </div>
  </div>
);
