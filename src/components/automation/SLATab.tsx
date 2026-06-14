import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SLATab = ({ companyId }: { companyId: string }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="border-border/40 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Políticas de SLA
          </CardTitle>
          <CardDescription>
            As políticas de SLA foram migradas para o painel de Administração para centralizar as configurações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl bg-muted/10">
            <Clock className="w-12 h-12 text-primary/50 mb-4" />
            <h3 className="text-lg font-bold mb-2">Gerenciamento Centralizado</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Para criar, editar ou excluir políticas de SLA (Service Level Agreement), acesse a aba "Configurações" no painel administrativo.
            </p>
            <Button onClick={() => navigate('/admin')} className="gap-2 font-bold shadow-lg shadow-primary/20">
              Gerenciar SLAs <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
