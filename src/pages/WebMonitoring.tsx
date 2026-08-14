import React, { useState, useMemo } from 'react';
import { useWebEndpoints, useCreateWebEndpoint, useDeleteWebEndpoint } from '@/hooks/useWebMonitoring';
import { useNetworkLinks, useCreateNetworkLink, useDeleteNetworkLink } from '@/hooks/useNetworkLinks';
import { useCompanies } from '@/hooks/useCompanies';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Plus, Trash2, Activity, AlertCircle, Clock, Zap, Radio, Router, Network, Building2, Wifi } from 'lucide-react';
import { toast } from 'sonner';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'Não verificado';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getLinkTypeInfo(type: string) {
  const normalized = type?.toLowerCase().replace(/[\s_]+/g, '') || '';
  if (normalized.includes('starlink')) {
    return {
      label: 'Starlink',
      icon: Radio,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    };
  }
  if (normalized.includes('roteador') || normalized.includes('router')) {
    return {
      label: 'Roteador',
      icon: Router,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    };
  }
  return {
    label: 'Link Dedicado',
    icon: Zap,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  };
}

export default function WebMonitoring() {
  // Tab 1 (Web Endpoints) states & hooks
  const { data: endpoints, isLoading: isLoadingEndpoints } = useWebEndpoints();
  const createWebEndpointMutation = useCreateWebEndpoint();
  const deleteWebEndpointMutation = useDeleteWebEndpoint();

  const [isWebModalOpen, setIsWebModalOpen] = useState(false);
  const [webName, setWebName] = useState('');
  const [webUrl, setWebUrl] = useState('');

  // Tab 2 (Network Links) states & hooks
  const { data: companies } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  const { data: networkLinks, isLoading: isLoadingNetworkLinks } = useNetworkLinks(
    selectedCompanyId !== 'all' ? selectedCompanyId : undefined
  );
  const createNetworkLinkMutation = useCreateNetworkLink();
  const deleteNetworkLinkMutation = useDeleteNetworkLink();

  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [netName, setNetName] = useState('');
  const [netType, setNetType] = useState<string>('link_dedicado');
  const [netCompanyId, setNetCompanyId] = useState<string>('none');
  const [netIpHost, setNetIpHost] = useState('');
  const [netStatus, setNetStatus] = useState<string>('online');
  const [netLatency, setNetLatency] = useState<string>('25');

  // Web Endpoints Handlers
  const handleCreateWebEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webName || !webUrl) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    let formattedUrl = webUrl;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      await createWebEndpointMutation.mutateAsync({ name: webName, url: formattedUrl });
      toast.success('Monitor criado com sucesso no UptimeRobot');
      setIsWebModalOpen(false);
      setWebName('');
      setWebUrl('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar monitor');
    }
  };

  const handleDeleteWebEndpoint = async (id: string) => {
    if (!confirm('Deseja realmente excluir este monitor?')) return;
    try {
      await deleteWebEndpointMutation.mutateAsync(id);
      toast.success('Monitor excluído com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir monitor');
    }
  };

  // Network Link Handlers
  const handleCreateNetworkLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!netName || !netIpHost) {
      toast.error('Preencha o nome e o IP/Hostname do link');
      return;
    }

    try {
      await createNetworkLinkMutation.mutateAsync({
        name: netName,
        type: netType,
        company_id: netCompanyId && netCompanyId !== 'none' ? netCompanyId : null,
        ip_or_host: netIpHost,
        status: netStatus,
        latency_ms: netLatency ? parseInt(netLatency, 10) : null,
      });
      toast.success('Link de internet adicionado com sucesso');
      setIsNetworkModalOpen(false);
      setNetName('');
      setNetType('link_dedicado');
      setNetCompanyId('none');
      setNetIpHost('');
      setNetStatus('online');
      setNetLatency('25');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar link de internet');
    }
  };

  const handleDeleteNetworkLink = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o link "${name}"?`)) return;
    try {
      await deleteNetworkLinkMutation.mutateAsync(id);
      toast.success('Link excluído com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir link');
    }
  };

  // Stats computation
  const webStats = useMemo(() => ({
    total: endpoints?.length || 0,
    online: endpoints?.filter(e => e.status === 'online').length || 0,
    offline: endpoints?.filter(e => e.status === 'offline').length || 0,
    pending: endpoints?.filter(e => e.status === 'pending' || e.status === 'paused').length || 0,
  }), [endpoints]);

  const filteredNetworkLinks = useMemo(() => {
    if (!networkLinks) return [];
    if (selectedTypeFilter === 'all') return networkLinks;
    return (networkLinks || []).filter(link => {
      const info = getLinkTypeInfo(link.type);
      return info.label.toLowerCase() === selectedTypeFilter.toLowerCase() ||
             link.type.toLowerCase().includes(selectedTypeFilter.toLowerCase());
    });
  }, [networkLinks, selectedTypeFilter]);

  const networkStats = useMemo(() => {
    const total = networkLinks?.length || 0;
    const online = networkLinks?.filter(l => l.status === 'online').length || 0;
    const offline = networkLinks?.filter(l => l.status === 'offline').length || 0;
    const activeLatencies = networkLinks
      ?.filter(l => l.status === 'online' && l.latency_ms !== null)
      .map(l => l.latency_ms as number) || [];
    
    const avgLatency = activeLatencies.length > 0
      ? Math.round(activeLatencies.reduce((a, b) => a + b, 0) / activeLatencies.length)
      : null;

    return { total, online, offline, avgLatency };
  }, [networkLinks]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Conectividade</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o status em tempo real de aplicações web, APIs e links de internet.
        </p>
      </div>

      <Tabs defaultValue="web" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="web" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Sites & Aplicações Web
          </TabsTrigger>
          <TabsTrigger value="network" className="flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Links de Internet & Redes
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SITES & APLICAÇÕES WEB */}
        <TabsContent value="web" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Sites & Aplicações Web</h2>
              <p className="text-sm text-muted-foreground">Monitores de disponibilidade HTTP/HTTPS via UptimeRobot.</p>
            </div>
            
            <Dialog open={isWebModalOpen} onOpenChange={setIsWebModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Monitor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Monitor Web</DialogTitle>
                  <DialogDescription>Adicione um site ou API para monitoramento contínuo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateWebEndpoint} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="webName">Nome Amigável</Label>
                    <Input 
                      id="webName" 
                      placeholder="Ex: API Principal" 
                      value={webName} 
                      onChange={e => setWebName(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webUrl">URL ou IP</Label>
                    <Input 
                      id="webUrl" 
                      placeholder="Ex: https://api.exemplo.com" 
                      value={webUrl} 
                      onChange={e => setWebUrl(e.target.value)} 
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsWebModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createWebEndpointMutation.isPending}>
                      {createWebEndpointMutation.isPending ? 'Salvando...' : 'Salvar'}
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
                <p className="text-3xl font-bold">{webStats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <Activity className="w-8 h-8 text-green-500 mb-2 opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">Online</p>
                <p className="text-3xl font-bold">{webStats.online}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2 opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">Offline</p>
                <p className="text-3xl font-bold">{webStats.offline}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <Clock className="w-8 h-8 text-yellow-500 mb-2 opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">Pendente / Pausado</p>
                <p className="text-3xl font-bold">{webStats.pending}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endpoints Web</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingEndpoints ? (
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
                        <Button variant="ghost" size="icon" aria-label="Excluir endpoint" onClick={() => handleDeleteWebEndpoint(endpoint.id)} title="Excluir" disabled={deleteWebEndpointMutation.isPending}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: LINKS DE INTERNET & REDES */}
        <TabsContent value="network" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Links de Internet & Redes</h2>
              <p className="text-sm text-muted-foreground">Monitoramento de links dedicados, Starlink e roteadores por empresa.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 min-w-[220px]">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Empresas</SelectItem>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={isNetworkModalOpen} onOpenChange={setIsNetworkModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Link de Internet
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Link de Internet</DialogTitle>
                    <DialogDescription>Cadastre um link dedicado, conexão Starlink ou roteador de rede.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateNetworkLink} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="netName">Nome do Link</Label>
                      <Input 
                        id="netName" 
                        placeholder="Ex: Link Dedicado - Matriz" 
                        value={netName} 
                        onChange={e => setNetName(e.target.value)} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="netType">Tipo de Conexão</Label>
                        <Select value={netType} onValueChange={setNetType}>
                          <SelectTrigger id="netType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="link_dedicado">Link Dedicado</SelectItem>
                            <SelectItem value="starlink">Starlink</SelectItem>
                            <SelectItem value="roteador">Roteador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="netCompany">Cliente / Empresa</Label>
                        <Select value={netCompanyId} onValueChange={setNetCompanyId}>
                          <SelectTrigger id="netCompany">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma (Geral)</SelectItem>
                            {companies?.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="netIpHost">IP ou Hostname</Label>
                      <Input 
                        id="netIpHost" 
                        placeholder="Ex: 200.150.10.1 ou gateway.empresa.com.br" 
                        value={netIpHost} 
                        onChange={e => setNetIpHost(e.target.value)} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="netStatus">Status Inicial</Label>
                        <Select value={netStatus} onValueChange={setNetStatus}>
                          <SelectTrigger id="netStatus">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="netLatency">Latência (ms)</Label>
                        <Input 
                          id="netLatency" 
                          type="number"
                          placeholder="Ex: 25" 
                          value={netLatency} 
                          onChange={e => setNetLatency(e.target.value)} 
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsNetworkModalOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={createNetworkLinkMutation.isPending}>
                        {createNetworkLinkMutation.isPending ? 'Salvando...' : 'Salvar Link'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Network Cards Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <Network className="w-8 h-8 text-blue-500 mb-2 opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">Total de Links</p>
                <p className="text-3xl font-bold">{networkStats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <Activity className="w-8 h-8 text-green-500 mb-2 opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">Online</p>
                <p className="text-3xl font-bold">{networkStats.online}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2 opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">Offline</p>
                <p className="text-3xl font-bold">{networkStats.offline}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <Wifi className="w-8 h-8 text-purple-500 mb-2 opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">Latência Média</p>
                <p className="text-3xl font-bold">{networkStats.avgLatency !== null ? `${networkStats.avgLatency} ms` : 'N/A'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Network Links List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Links Registrados</CardTitle>
                <CardDescription>
                  {selectedCompanyId === 'all' 
                    ? 'Exibindo links de todas as empresas' 
                    : `Exibindo links da empresa selecionada`}
                </CardDescription>
              </div>
              <div className="w-[180px]">
                <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de Link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="link dedicado">Link Dedicado</SelectItem>
                    <SelectItem value="starlink">Starlink</SelectItem>
                    <SelectItem value="roteador">Roteador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingNetworkLinks ? (
                <div className="text-center py-8 text-muted-foreground">Carregando links de rede...</div>
              ) : filteredNetworkLinks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                  <Radio className="w-12 h-12 opacity-20 mb-4" />
                  <p className="text-base font-medium">Nenhum link de internet encontrado.</p>
                  <p className="text-sm opacity-70 mt-1">Clique em "Novo Link de Internet" para cadastrar o primeiro link.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(filteredNetworkLinks || []).map(link => {
                    const typeInfo = getLinkTypeInfo(link.type);
                    const TypeIcon = typeInfo.icon;
                    return (
                      <div 
                        key={link.id} 
                        className="p-5 border rounded-xl hover:shadow-md transition-all bg-card flex flex-col justify-between space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-lg border ${typeInfo.color}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-base leading-tight">{link.name}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{link.ip_or_host}</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" 
                            onClick={() => handleDeleteNetworkLink(link.id, link.name)} 
                            title="Excluir"
                            disabled={deleteNetworkLinkMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-2 pt-2 border-t text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Tipo:</span>
                            <Badge variant="outline" className="font-medium">
                              {typeInfo.label}
                            </Badge>
                          </div>

                          {link.company_name && (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Empresa:</span>
                              <span className="font-medium text-foreground truncate max-w-[150px]" title={link.company_name}>
                                {link.company_name}
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Latência:</span>
                            <span className="font-mono font-medium">
                              {link.latency_ms !== null && link.latency_ms !== undefined ? `${link.latency_ms} ms` : 'N/A'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Última Checagem:</span>
                            <span className="text-muted-foreground">
                              {formatDate(link.last_check)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-between items-center">
                          <Badge 
                            variant={
                              link.status === 'online' ? 'default' : 
                              link.status === 'offline' ? 'destructive' : 'secondary'
                            } 
                            className={link.status === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}
                          >
                            {link.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
