import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Crown, AlertTriangle } from 'lucide-react';
import { usePlanUsage } from '@/hooks/usePlanUsage';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PlanUsageCardProps {
  onLimitReached?: (isLimitReached: boolean) => void;
}

export const PlanUsageCard: React.FC<PlanUsageCardProps> = ({ onLimitReached }) => {
  const { data: planUsage, isLoading, error } = usePlanUsage();
  
  const isLimitReached = planUsage ? planUsage.current_users >= planUsage.max_users : false;
  const isNearLimit = planUsage ? planUsage.current_users >= planUsage.max_users * 0.8 : false;
  const usagePercentage = planUsage ? Math.min((planUsage.current_users / planUsage.max_users) * 100, 100) : 0;
  
  // Notificar o componente pai sobre o limite
  React.useEffect(() => {
    if (onLimitReached) {
      onLimitReached(isLimitReached);
    }
  }, [isLimitReached, onLimitReached]);
  
  // Determinar cor da barra de progresso
  const getProgressColor = () => {
    if (isLimitReached) return 'bg-destructive';
    if (isNearLimit) return 'bg-warning';
    return 'bg-primary';
  };
  
  // Determinar badge do plano
  const getPlanBadge = () => {
    const planName = planUsage?.plan_name || 'Starter';
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; icon?: React.ReactNode }> = {
      'Starter': { variant: 'secondary' },
      'Business': { variant: 'default' },
      'Enterprise': { variant: 'default', icon: <Crown className="h-3 w-3 mr-1" /> },
    };
    
    const config = variants[planName] || { variant: 'secondary' };
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {planName}
      </Badge>
    );
  };
  
  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (error || !planUsage) {
    return null; // Silenciosamente não mostrar o card se houver erro
  }
  
  // Não mostrar "Ilimitado" literalmente, mas mostrar número alto de forma elegante
  const displayMaxUsers = planUsage.max_users >= 1000000 ? 'Ilimitado' : planUsage.max_users;
  
  return (
    <Card className={`mb-6 ${isLimitReached ? 'border-destructive' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Uso do Plano</CardTitle>
          </div>
          {getPlanBadge()}
        </div>
        <CardDescription>
          Licenças de usuários utilizadas na sua empresa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Você está usando <span className="font-semibold text-foreground">{planUsage.current_users}</span> de{' '}
              <span className="font-semibold text-foreground">{displayMaxUsers}</span> licenças
            </span>
            {isLimitReached && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium">Limite atingido</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Faça upgrade do plano para adicionar mais usuários</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {planUsage.max_users < 1000000 && (
            <div className="relative">
              <Progress 
                value={usagePercentage} 
                className="h-2"
              />
              <div 
                className={`absolute top-0 left-0 h-full rounded-full transition-all ${getProgressColor()}`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          )}
          
          {isNearLimit && !isLimitReached && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Você está próximo do limite do seu plano
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
