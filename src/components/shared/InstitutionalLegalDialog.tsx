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
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden sm:rounded-xl border-border bg-card">
        <DialogHeader className="p-6 pb-4 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
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
                      O agente instalado nas estações coleta dados técnicos da máquina para manutenção preventiva e resolução de incidentes: uso de CPU, memória e disco, rede (IP e MAC), hardware, sistema operacional e atualizações pendentes, estado de antivírus, firewall e BitLocker, programas de acesso remoto instalados e o usuário do Windows logado no momento. O agente também executa, a pedido da equipe técnica, instalações e atualizações enviadas pelo Orion, sempre com conferência do arquivo por hash SHA-256.
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
                      O Orion System trata dados pessoais conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), apenas para prestar suporte técnico e gerenciar os ativos de TI dos clientes. São tratados: nome, e-mail, departamento e foto de perfil (opcional, só para a equipe técnica); o conteúdo e os anexos dos chamados; e os dados técnicos coletados pelo Orion Agent descritos nos Termos de Uso, incluindo o usuário do Windows logado na máquina.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">2. Quem vê cada informação</h4>
                    <p>
                      Os dados de cada empresa cliente são separados por políticas RLS (Row Level Security) no banco de dados. Usuários comuns e gestores de uma empresa cliente veem só as informações da própria empresa. A equipe técnica que presta o suporte (técnicos, desenvolvedores e administradores das empresas responsáveis pelo atendimento) tem acesso às empresas atendidas, para poder resolver os chamados e acompanhar as máquinas. As respostas prontas usadas no atendimento são compartilhadas por toda a equipe técnica.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">3. Registro de Auditoria</h4>
                    <p>
                      Operações importantes, como alterações de cadastro, de chamados e de pacotes de instalação, ficam registradas com data e hora. Usuários do sistema não podem alterar nem apagar esses registros; eles podem ser consultados pelos administradores da empresa e pelos desenvolvedores.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">4. Onde os dados ficam</h4>
                    <p>
                      O cadastro, os chamados e os anexos ficam no Supabase (banco de dados, autenticação e armazenamento de arquivos), com criptografia em repouso. A aplicação roda na Vercel, e os e-mails do sistema são enviados pela Resend. As métricas de monitoramento das máquinas ficam no servidor de monitoramento da equipe responsável pelo atendimento. Toda a comunicação entre navegador, agente e servidores usa conexão criptografada (HTTPS/TLS).
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">5. Navegador</h4>
                    <p>
                      O sistema guarda no seu navegador apenas o necessário para funcionar: a sessão de login e preferências de tela, como tema e modo de exibição. Não são usados cookies de publicidade nem rastreadores de terceiros.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">6. Seus direitos</h4>
                    <p>
                      Você pode pedir acesso, correção ou exclusão dos seus dados pessoais abrindo um chamado ou falando com o administrador da sua empresa. Fotos de perfil podem ser trocadas a qualquer momento em Ajustes do Perfil.
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
