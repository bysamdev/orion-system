import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Zap } from 'lucide-react';
import { useCannedResponses, useAddCannedResponse, useDeleteCannedResponse, useUpdateCannedResponse, CannedResponse } from '@/hooks/useCannedResponses';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const CannedResponsesManagement: React.FC = () => {
  const { data: responses = [], isLoading } = useCannedResponses();
  const addResponse = useAddCannedResponse();
  const updateResponse = useUpdateCannedResponse();
  const deleteResponse = useDeleteCannedResponse();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');

  const resetForm = () => {
    setTitle('');
    setContent('');
    setShortcut('');
    setEditMode(false);
    setEditingId(null);
  };

  const openEditDialog = (response: CannedResponse) => {
    setTitle(response.title);
    setContent(response.content);
    setShortcut(response.shortcut || '');
    setEditMode(true);
    setEditingId(response.id);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Título e Conteúdo são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editMode && editingId) {
        await updateResponse.mutateAsync({
          id: editingId,
          data: {
            title: title.trim(),
            content: content.trim(),
            shortcut: shortcut.trim() || undefined,
          },
        });
      } else {
        await addResponse.mutateAsync({
          title: title.trim(),
          content: content.trim(),
          shortcut: shortcut.trim() || undefined,
        });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDelete = async () => {
    if (!selectedResponse) return;

    try {
      await deleteResponse.mutateAsync(selectedResponse);
      setDeleteDialogOpen(false);
      setSelectedResponse(null);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Carregando respostas prontas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Respostas Prontas
            </CardTitle>
            <CardDescription className="mt-2">
              Gerencie respostas pré-configuradas para agilizar o atendimento
            </CardDescription>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Resposta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Editar Resposta Pronta' : 'Criar Resposta Pronta'}
                </DialogTitle>
                <DialogDescription>
                  {editMode 
                    ? 'Atualize os dados da resposta pronta'
                    : 'Crie uma resposta pré-configurada para usar nos atendimentos'
                  }
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Solicitar Acesso Remoto"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortcut">Atalho (opcional)</Label>
                  <Input
                    id="shortcut"
                    placeholder="Ex: /acesso"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    Um comando rápido para encontrar esta resposta
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Conteúdo *</Label>
                  <Textarea
                    id="content"
                    placeholder="Digite o texto completo da resposta pronta..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    maxLength={5000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {content.length}/5000 caracteres
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={addResponse.isPending || updateResponse.isPending}>
                  {(addResponse.isPending || updateResponse.isPending) ? 'Salvando...' : (editMode ? 'Atualizar' : 'Criar Resposta')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {responses.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              Nenhuma resposta pronta cadastrada
            </p>
            <p className="text-sm text-muted-foreground">
              Crie respostas prontas para agilizar o atendimento aos chamados
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Atalho</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="font-medium">
                      {response.title}
                    </TableCell>
                    <TableCell>
                      {response.shortcut ? (
                        <Badge variant="secondary">{response.shortcut}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {response.content}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(response)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedResponse(response.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta pronta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A resposta pronta será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
