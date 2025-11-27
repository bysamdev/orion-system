import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

export interface TicketFiltersState {
  search: string;
  status: string;
  priority: string;
  category: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface TicketFiltersProps {
  filters: TicketFiltersState;
  onFiltersChange: (filters: Partial<TicketFiltersState>) => void;
  onReset: () => void;
}

export const TicketFilters = ({ filters, onFiltersChange, onReset }: TicketFiltersProps) => {
  const hasActiveFilters = 
    filters.search || 
    filters.priority !== 'all' || 
    filters.category !== 'all';

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, descrição ou número..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Priority Filter */}
        <Select value={filters.priority} onValueChange={(value) => onFiltersChange({ priority: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Prioridades</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select value={filters.category} onValueChange={(value) => onFiltersChange({ category: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            <SelectItem value="hardware">Hardware</SelectItem>
            <SelectItem value="software">Software</SelectItem>
            <SelectItem value="network">Rede</SelectItem>
            <SelectItem value="access">Acesso</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={`${filters.sortBy}-${filters.sortOrder}`} onValueChange={(value) => {
          const [sortBy, sortOrder] = value.split('-');
          onFiltersChange({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' });
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at-desc">Mais Recentes</SelectItem>
            <SelectItem value="created_at-asc">Mais Antigos</SelectItem>
            <SelectItem value="priority-desc">Prioridade (Alta→Baixa)</SelectItem>
            <SelectItem value="priority-asc">Prioridade (Baixa→Alta)</SelectItem>
            <SelectItem value="ticket_number-desc">Número (Desc)</SelectItem>
            <SelectItem value="ticket_number-asc">Número (Asc)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReset}
          className="w-full md:w-auto"
        >
          <X className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );
};
