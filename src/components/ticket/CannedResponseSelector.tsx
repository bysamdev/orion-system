import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Search } from 'lucide-react';
import { useCannedResponses } from '@/hooks/useCannedResponses';
import { Badge } from '@/components/ui/badge';

interface CannedResponseSelectorProps {
  onSelect: (content: string) => void;
}

export const CannedResponseSelector: React.FC<CannedResponseSelectorProps> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: responses = [], isLoading } = useCannedResponses();

  const filteredResponses = responses.filter(
    (response) =>
      response.title.toLowerCase().includes(search.toLowerCase()) ||
      response.content.toLowerCase().includes(search.toLowerCase()) ||
      (response.shortcut && response.shortcut.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (content: string) => {
    onSelect(content);
    setOpen(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Zap className="w-4 h-4" />
          Respostas Prontas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Respostas Prontas</DialogTitle>
          <DialogDescription>
            Selecione uma resposta pronta para inserir no comentário
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, conteúdo ou atalho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando respostas prontas...
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta pronta cadastrada'}
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredResponses.map((response) => (
                  <button
                    key={response.id}
                    onClick={() => handleSelect(response.content)}
                    className="w-full text-left p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-medium text-foreground">{response.title}</h4>
                      {response.shortcut && (
                        <Badge variant="secondary" className="text-xs">
                          {response.shortcut}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {response.content}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
