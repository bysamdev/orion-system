import React, { useState } from 'react';
import { useWebEndpoints, useCreateWebEndpoint, useDeleteWebEndpoint } from '@/hooks/useWebMonitoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Globe, Plus, Trash2, Activity, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function WebMonitoring() {
  const { data: endpoints, isLoading } = useWebEndpoints();
  const createMutation = useCreateWebEndpoint();
  const deleteMutation = useDeleteWebEndpoint();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    let formattedUrl = url;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      await createMutation.mutateAsync({ name, url: formattedUrl });
      toast.success('Monitor criado com sucesso no UptimeRobot');
      setIsOpen(false);
      setName('');
      setUrl('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar monitor');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este monitor?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Monitor excluído com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir monitor');
    }
  };

  const stats = {
    total: endpoints?.length || 0,
    online: endpoints?.filter(e => e.status === 'online').length || 0,
    offline: endpoints?.filter(e => e.status === 'offline').length || 0,
    pending: endpoints?.filter(e => e.status === 'pending' || e.status === 'paused').length || 0,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoramento Web</h1>
          <p className="text-muted-foreground mt-1">
            Status em tempo real de sites e APIs através do UptimeRobot.
          </p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Monitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Monitor Web</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Amigável</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: API Principal" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL ou IP</Label>
                <Input 
                  id="url" 
                  placeholder="Ex: https://api.exemplo.com" 
                  value={url} 
                  onChange={e => setUrl(e.target.value)} 
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Globe className="w-8 h-8 text-blue-500 mb-2 opacity-80" />
            <p className="text-sm font-medium text-muted-foreground">Total de Monitores</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Activity className="w-8 h-8 text-green-500 mb-2 opacity-80" />
            <p className="text-sm font-medium text-muted-foreground">Online</p>
            <p className="text-3xl font-bold">{stats.online}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2 opacity-80" />
            <p className="text-sm font-medium text-muted-foreground">Offline</p>
            <p className="text-3xl font-bold">{stats.offline}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Clock className="w-8 h-8 text-yellow-500 mb-2 opacity-80" />
            <p className="text-sm font-medium text-muted-foreground">Pendente / Pausado</p>
            <p className="text-3xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando monitores...</div>
          ) : endpoints?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
              <Globe className="w-12 h-12 opacity-20 mb-4" />
              Nenhum monitor configurado. Adicione o seu primeiro site!
            </div>
          ) : (
            <div className="space-y-4">
              {endpoints?.map(endpoint => (
                <div key={endpoint.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{endpoint.name}</p>
                      <a href={endpoint.url_or_ip} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline">
                        {endpoint.url_or_ip}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <Badge variant={
                      endpoint.status === 'online' ? 'default' : 
                      endpoint.status === 'offline' ? 'destructive' : 'secondary'
                    } className={endpoint.status === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}>
                      {endpoint.status.toUpperCase()}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(endpoint.id)} title="Excluir" disabled={deleteMutation.isPending}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
