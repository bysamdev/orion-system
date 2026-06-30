import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Zap, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCannedResponses, useSaveCannedResponse, useDeleteCannedResponse, type CannedResponseFull } from '@/hooks/useAutomation';

interface Props {
  companyId: string;
}

export const TemplatesTab: React.FC<Props> = ({ companyId }) => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponseFull | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');

  const { data: responses = [], isLoading } = useCannedResponses(companyId);
  const saveMutation = useSaveCannedResponse(companyId);
  const deleteMutation = useDeleteCannedResponse();

  const resetForm = () => { setEditing(null); setTitle(''); setContent(''); setShortcut(''); };

  const openEdit = (r: CannedResponseFull) => {
    setEditing(r);
    setTitle(r.title);
    setContent(r.content);
    setShortcut(r.shortcut ?? '');
    setDialogOpen(true);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Preencha título e conteúdo', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(
      { id: editing?.id, title, content, shortcut },
      {
        onSuccess: () => {
          toast({ title: editing ? 'Template atualizado' : 'Template criado' });
          setDialogOpen(false);
          resetForm();
        },
        onError: (err: Error) => toast({ title: err.message ?? 'Erro', variant: 'destructive' }),
      },
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este template?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: 'Template removido' }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Templates de Resposta</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Respostas prontas disponíveis no editor de chamados e nas regras de automação.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <ButtonPrimary onClick={openNew} className="font-bold" icon={<Plus className="w-4 h-4" />}>
              Novo Template
            </ButtonPrimary>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Template' : 'Novo Template de Resposta'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider">Título *</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Saudação Inicial" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider">Atalho</Label>
                  <Input value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder="/oi" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Conteúdo *</Label>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Texto da resposta pronta..."
                  className="min-h-[140px] resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right">{content.length} caracteres</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {responses.map(r => (
            <Card key={r.id} className="group border-border/50 hover:border-primary/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm text-foreground">{r.title}</h3>
                  {r.shortcut && <Badge variant="secondary" className="text-[9px] font-black shrink-0">{r.shortcut}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{r.content}</p>
                <div className="flex items-center justify-end gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(r)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {responses.length === 0 && (
            <Card className="border-dashed col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Zap className="w-10 h-10 text-muted-foreground/30" />
                <div>
                  <p className="font-bold">Nenhum template cadastrado</p>
                  <p className="text-sm text-muted-foreground">Crie templates para agilizar as respostas da equipe.</p>
                </div>
                <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Criar Primeiro Template</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
