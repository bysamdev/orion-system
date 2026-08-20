import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Laptop, Network, Router, Server, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeviceItem } from '@/hooks/useDeviceInventory';

interface AssetTopologyGraphProps {
  devices: DeviceItem[];
  /** Nome do cliente filtrado, exibido no cabeçalho. Vazio = todos. */
  companyName?: string;
  /** true quando há filtro de cliente ativo — desliga o agrupamento por empresa. */
  isFiltered?: boolean;
}

type Camada = 'borda' | 'rede' | 'estacoes';

const CAMADAS: Array<{ id: Camada; titulo: string; descricao: string; icone: React.ElementType }> = [
  { id: 'borda', titulo: 'Borda e Servidores', descricao: 'Gateways, firewalls e servidores', icone: Server },
  { id: 'rede', titulo: 'Rede', descricao: 'Switches e concentradores', icone: Router },
  { id: 'estacoes', titulo: 'Estações de Trabalho', descricao: 'Computadores e notebooks', icone: Laptop },
];

/** Classifica o dispositivo na camada da topologia. */
function camadaDo(d: DeviceItem): Camada {
  const tipo = (d.device_type || '').toLowerCase();
  const host = (d.hostname || '').toLowerCase();

  if (tipo === 'switch' || host.includes('sw')) return 'rede';
  if (tipo === 'servidor' || tipo === 'server' || host.includes('fw') || host.includes('gw')) {
    return 'borda';
  }
  return 'estacoes';
}

const nomeDe = (d: DeviceItem) => d.hostname || d.name || 'Sem identificação';
const ipDe = (d: DeviceItem) => d.ip_address || d.local_ip || null;

export const AssetTopologyGraph: React.FC<AssetTopologyGraphProps> = ({
  devices,
  companyName,
  isFiltered = false,
}) => {
  const [selecionado, setSelecionado] = useState<DeviceItem | null>(null);

  /**
   * Agrupa por cliente e, dentro de cada cliente, por camada.
   *
   * Sem filtro de empresa, a topologia misturava o parque de todos os clientes
   * numa malha só — o que não representa rede nenhuma, já que são redes
   * fisicamente separadas. Com filtro ativo, cai para um grupo só.
   */
  const grupos = useMemo(() => {
    const porEmpresa = new Map<string, DeviceItem[]>();
    for (const d of devices) {
      const chave = d.company_name || 'Sem cliente vinculado';
      const lista = porEmpresa.get(chave);
      if (lista) lista.push(d);
      else porEmpresa.set(chave, [d]);
    }

    return Array.from(porEmpresa.entries())
      .map(([empresa, lista]) => ({
        empresa,
        total: lista.length,
        online: lista.filter((d) => d.status === 'online').length,
        camadas: CAMADAS.map((c) => ({ ...c, itens: lista.filter((d) => camadaDo(d) === c.id) })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [devices]);

  if (devices.length === 0) {
    return (
      <Card className="border-border/40 shadow-sm min-h-[420px] flex flex-col">
        <CardHeader className="p-5 border-b border-border/40">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            Topologia de Rede
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
          <Network className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Nenhum dispositivo no filtro atual</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Ajuste os filtros de cliente, tipo ou status para visualizar a topologia.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-border/40 bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Topologia de Rede
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {isFiltered && companyName && (
                <Badge variant="outline" className="gap-1.5 font-semibold">
                  <Building2 className="w-3 h-3" />
                  {companyName}
                </Badge>
              )}
              <Badge variant="outline" className="tabular-nums">
                {devices.length} {devices.length === 1 ? 'dispositivo' : 'dispositivos'}
              </Badge>
              {!isFiltered && grupos.length > 1 && (
                <Badge variant="outline" className="tabular-nums">
                  {grupos.length} clientes
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {grupos.map((grupo) => (
        <Card key={grupo.empresa} className="border-border/40 shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b border-border/40 bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Building2 className="w-4 h-4 text-primary" />
                {grupo.empresa}
              </CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="tabular-nums font-medium text-foreground">{grupo.online}</span> online
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="tabular-nums font-medium text-foreground">
                    {grupo.total - grupo.online}
                  </span>{' '}
                  fora do ar
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5">
            {/* Espinha vertical: as três camadas de rede (borda → rede →
                estações) formam um fluxo de cima pra baixo, não blocos soltos.
                Uma linha contínua atravessa os ícones de camada; cada camada
                puxa um traço curto até a grade de dispositivos à direita.
                Não liga individualmente a cada dispositivo (a grade cresce
                até dezenas de itens e não escala como árvore 1:1), mas deixa
                a hierarquia da rede legível de imediato. */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute left-[15px] top-5 bottom-5 w-px bg-border"
              />
              <div className="space-y-8">
                {grupo.camadas.map((camada) => (
                  <div key={camada.id} className="relative flex gap-4">
                    <div className="relative z-10 flex-shrink-0 pt-0.5">
                      <div
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-full border-2 bg-card',
                          camada.itens.length > 0
                            ? 'border-primary/50 text-primary'
                            : 'border-border text-muted-foreground/50',
                        )}
                      >
                        <camada.icone className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex items-baseline gap-2 mb-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {camada.titulo}
                        </h3>
                        <span className="text-xs text-muted-foreground">· {camada.descricao}</span>
                        <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                          {camada.itens.length}
                        </span>
                      </div>

                      {camada.itens.length > 0 ? (
                        // Grade de largura fixa: o flex-wrap centralizado deixava a
                        // última linha desalinhada das anteriores.
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                          {camada.itens.map((d) => (
                            <TopologyNode
                              key={d.id}
                              device={d}
                              icone={camada.icone}
                              ativo={selecionado?.id === d.id}
                              onClick={() => setSelecionado((atual) => (atual?.id === d.id ? null : d))}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-3 px-3 rounded-lg bg-muted/30 border border-border/40">
                          Nenhum item nesta camada.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Detalhe do nó selecionado. O estado existia antes mas nunca era lido —
          clicar num dispositivo não produzia efeito nenhum. */}
      {selecionado && (
        <Card className="border-primary/40 shadow-sm">
          <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-foreground">
              {nomeDe(selecionado)}
            </CardTitle>
            <button
              onClick={() => setSelecionado(null)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Fechar detalhes do dispositivo"
            >
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="p-4">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { rotulo: 'Status', valor: selecionado.status || '—' },
                { rotulo: 'Endereço IP', valor: ipDe(selecionado) || 'Não informado' },
                { rotulo: 'Cliente', valor: selecionado.company_name || 'Não vinculado' },
                { rotulo: 'Tipo', valor: selecionado.device_type || 'Não informado' },
              ].map((c) => (
                <div key={c.rotulo}>
                  <dt className="text-xs text-muted-foreground mb-1">{c.rotulo}</dt>
                  <dd className="font-medium text-foreground truncate capitalize" title={String(c.valor)}>
                    {c.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const TopologyNode = ({
  device,
  icone: Icone,
  onClick,
  ativo,
}: {
  device: DeviceItem;
  icone: React.ElementType;
  onClick: () => void;
  ativo: boolean;
}) => {
  const online = device.status === 'online';
  const alerta = device.status === 'alerta';
  const ip = ipDe(device);
  const nome = nomeDe(device);

  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      // Status por cor E por texto: quem não distingue as cores ainda lê o
      // estado no rótulo abaixo do nome.
      aria-label={`${nome}, ${online ? 'online' : alerta ? 'em alerta' : 'offline'}${ip ? `, IP ${ip}` : ''}`}
      className={cn(
        'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border bg-card text-center',
        'transition-colors hover:border-primary/60 hover:bg-accent/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        ativo ? 'border-primary ring-2 ring-primary/30' : 'border-border/60',
      )}
    >
      <span
        className={cn(
          'absolute top-2 right-2 w-2.5 h-2.5 rounded-full',
          online ? 'bg-emerald-500' : alerta ? 'bg-amber-500' : 'bg-rose-500',
        )}
      />
      {/* Ícone da própria camada (servidor/roteador/notebook), não um
          símbolo genérico igual pra tudo — reforça visualmente em qual
          nível da rede aquele dispositivo está, mesmo fora do contexto da
          seção. */}
      <Icone className="w-5 h-5 text-muted-foreground" />
      <span className="text-xs font-semibold text-foreground truncate w-full" title={nome}>
        {nome}
      </span>
      <span className="text-[11px] font-mono text-muted-foreground truncate w-full">
        {ip ?? 'sem IP'}
      </span>
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          online
            ? 'text-emerald-700 dark:text-emerald-400'
            : alerta
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-rose-700 dark:text-rose-400',
        )}
      >
        {online ? 'online' : alerta ? 'alerta' : 'offline'}
      </span>
    </button>
  );
};
