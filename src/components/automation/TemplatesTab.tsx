import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Zap, Plus, Edit2, Trash2, Search, Copy, Check, MessageSquare, Sparkles, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCannedResponses, useSaveCannedResponse, useDeleteCannedResponse, type CannedResponseFull } from '@/hooks/useAutomation';

interface Props {
  companyId: string;
}

export const TemplatesTab: React.FC<Props> = ({ companyId }) => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponseFull | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

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

  const handleCopy = (r: CannedResponseFull) => {
    navigator.clipboard.writeText(r.content);
    setCopiedId(r.id);
    toast({ title: 'Texto copiado para a área de transferência!' });
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Preencha título e conteúdo', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(
      { id: editing?.id, title, content, shortcut },
      {
        onSuccess: () => {
          toast({ title: editing ? 'Template atualizado com sucesso!' : 'Template criado com sucesso!' });
          setDialogOpen(false);
          resetForm();
        },
        onError: (err: Error) => toast({ title: err.message ?? 'Erro ao salvar template', variant: 'destructive' }),
      },
    );
  };

  const handleDelete = (id: string) => {
    setTemplateToDelete(id);
  };

  const filteredResponses = useMemo(() => {
    if (!searchQuery.trim()) return responses;
    const query = searchQuery.toLowerCase();
    return responses.filter(r =>
      r.title.toLowerCase().includes(query) ||
      r.content.toLowerCase().includes(query) ||
      (r.shortcut && r.shortcut.toLowerCase().includes(query))
    );
  }, [responses, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header com Busca e Criação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-4 rounded-2xl border border-border/40 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-sm tracking-tight text-foreground">Respostas Prontas & Templates</h2>
          </div>
          <p className="text-xs text-muted-foreground">Modelos ágeis disponíveis no chat de atendimento, regras de automação e atalhos rápidos de teclado.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou /atalho..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background/60"
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <ButtonPrimary onClick={openNew} className="font-bold h-9" icon={<Plus className="w-4 h-4" />}>
                Novo Template
              </ButtonPrimary>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {editing ? 'Editar Template' : 'Novo Template de Resposta'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Título da Resposta *</Label>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Ex: Solicitação de Acesso Remoto"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Atalho Rápido</Label>
                    <div className="relative">
                      <Terminal className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={shortcut}
                        onChange={e => setShortcut(e.target.value)}
                        placeholder="/remoto"
                        className="pl-8 rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider">Conteúdo da Mensagem *</Label>
                    <span className="text-[10px] text-muted-foreground">{content.length} caracteres</span>
                  </div>
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Digite o texto da resposta pronta que será inserido no chamado..."
                    className="min-h-[160px] resize-none rounded-xl leading-relaxed text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Dica: Use <strong>{shortcut || '/atalho'}</strong> diretamente na caixa de resposta do chamado para carregar o texto.</span>
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} className="rounded-xl font-bold">
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Salvar Alterações' : 'Criar Template'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-xs text-muted-foreground">Carregando templates...</p>
        </div>
      ) : responses.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
              <Zap className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground text-base">Nenhum template cadastrado</p>
              <p className="text-xs text-muted-foreground max-w-md">Crie respostas prontas com atalhos inteligentes para que sua equipe atenda chamados com máxima agilidade e consistência.</p>
            </div>
            <ButtonPrimary onClick={openNew} className="gap-2 font-bold mt-2" icon={<Plus className="w-4 h-4" />}>
              Criar Primeiro Template
            </ButtonPrimary>
          </CardContent>
        </Card>
      ) : filteredResponses.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Search className="w-8 h-8 text-muted-foreground/40" />
            <p className="font-semibold text-sm text-foreground">Nenhum template encontrado</p>
            <p className="text-xs text-muted-foreground">Tente buscar por outro título, palavra-chave ou atalho.</p>
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="mt-2 text-xs">
              Limpar busca
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredResponses.map(r => (
            <Card
              key={r.id}
              className="group border-border/50 bg-card/60 backdrop-blur-sm hover:border-amber-500/40 hover:shadow-md transition-all duration-300 rounded-2xl flex flex-col justify-between overflow-hidden"
            >
              <CardContent className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  {/* Topo do Card de Template */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-bold text-sm text-foreground truncate">{r.title}</h3>
                    </div>

                    {r.shortcut && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 shrink-0"
                      >
                        {r.shortcut}
                      </Badge>
                    )}
                  </div>

                  {/* Conteúdo com caixa estilizada */}
                  <div className="bg-muted/30 border border-border/40 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed font-normal whitespace-pre-line line-clamp-4">
                    {r.content}
                  </div>
                </div>

                {/* Footer do Card com Ações */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {r.content.length} caracteres
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg"
                      onClick={() => handleCopy(r)}
                      title="Copiar texto"
                    >
                      {copiedId === r.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] text-emerald-500 font-bold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[10px]">Copiar</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar modelo"
                      className="h-7 w-7 rounded-lg hover:text-primary hover:bg-primary/10"
                      onClick={() => openEdit(r)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir modelo"
                      className="h-7 w-7 rounded-lg hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template de Resposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Este template não estará mais disponível para respostas rápidas e regras de automação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-xl"
              onClick={() => {
                if (templateToDelete) {
                  deleteMutation.mutate(templateToDelete, {
                    onSuccess: () => toast({ title: 'Template removido com sucesso' }),
                  });
                  setTemplateToDelete(null);
                }
              }}
            >
              Excluir Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

