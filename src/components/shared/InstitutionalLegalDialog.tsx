import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, FileText } from 'lucide-react';

interface InstitutionalLegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'terms' | 'privacy';
}

export const InstitutionalLegalDialog: React.FC<InstitutionalLegalDialogProps> = ({
  open,
  onOpenChange,
  defaultTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(defaultTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden sm:rounded-2xl border-border bg-card">
        <DialogHeader className="p-6 pb-4 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Informações Institucionais & Conformidade
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Diretrizes de segurança, governança de dados e condições de uso da plataforma Orion System.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pt-4 flex-1 flex flex-col min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'terms' | 'privacy')}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid grid-cols-2 w-full mb-4 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="terms" className="text-xs font-semibold py-1.5 gap-2">
                <FileText className="w-3.5 h-3.5" />
                Termos de Uso
              </TabsTrigger>
              <TabsTrigger value="privacy" className="text-xs font-semibold py-1.5 gap-2">
                <Shield className="w-3.5 h-3.5" />
                Política de Privacidade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="terms" className="flex-1 min-h-0 m-0 outline-none">
              <ScrollArea className="h-[360px] pr-4 text-xs text-muted-foreground leading-relaxed space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">1. Objeto e Escopo</h4>
                    <p>
                      O Orion System é uma plataforma integrada de Service Desk, Monitoramento e Gestão de TI (RMM) destinada ao suporte operacional e à governança técnica de infraestruturas corporativas.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">2. Acesso e Responsabilidades</h4>
                    <p>
                      O acesso é pessoal, intransferível e condicionado às permissões atribuídas por nível de perfil (Administrador, Desenvolvedor, Técnico ou Solicitante). Cada usuário é responsável pela confidencialidade de suas credenciais e pelo uso ético das ferramentas de execução e suporte remoto.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">3. Agente de Monitoramento (Orion Agent)</h4>
                    <p>
                      O agente instalado nas estações de trabalho coleta estritamente métricas de saúde de hardware (CPU, RAM, Disco, conectividade de rede e inventário de sistema operacional) para fins de manutenção preventiva e resolução de incidentes.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">4. Disponibilidade do Serviço</h4>
                    <p>
                      As rotinas de manutenção preventiva e atualizações de versão são executadas visando a máxima continuidade de serviço e a integridade contínua dos dados dos clientes.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="privacy" className="flex-1 min-h-0 m-0 outline-none">
              <ScrollArea className="h-[360px] pr-4 text-xs text-muted-foreground leading-relaxed space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">1. Tratamento de Dados (LGPD)</h4>
                    <p>
                      O Orion System opera em conformidade com as diretrizes da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), coletando exclusivamente as informações necessárias para a prestação de suporte técnico e gerenciamento de ativos.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">2. Isolamento Multi-Tenant</h4>
                    <p>
                      Todas as informações organizacionais, chamados, métricas de telemetria e registros de auditoria são rigorosamente isolados por empresa através de políticas RLS (Row Level Security) ativas no banco de dados.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">3. Registro de Auditoria</h4>
                    <p>
                      Operações críticas (criação de pacotes, fechamento de chamados e alterações cadastrais) são registradas em logs de auditoria imutáveis com carimbo de data/hora para fins de conformidade e rastreabilidade.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">4. Retenção e Segurança</h4>
                    <p>
                      Os dados de telemetria e chamados são armazenados em infraestrutura segura com criptografia em repouso e em trânsito (TLS 1.3).
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
