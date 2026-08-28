import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  KeyRound,
  Copy,
  CheckCircle2,
  Download,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Lock,
  Smartphone,
  Info,
  Shield,
  Eye,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole, useUserProfile } from "@/hooks/useUserRole";
import {
  enrollTotpFactor,
  verifyTotpEnrollment,
  unenrollTotpFactor,
  getMfaStatus,
  generateBackupCodes,
  saveBackupCodes,
  getBackupCodesStatus,
  downloadBackupCodesAsText,
  TotpEnrollmentData,
  BackupCodesStatus,
} from "@/lib/mfa";
import { cn } from "@/lib/utils";

export const TwoFactorAuthSettings = () => {
  const { toast } = useToast();
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();

  const isRequiredRole = role === "admin" || role === "developer";
  const isGestorOrDev = role === "admin" || role === "developer";

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [isMfaEnabled, setIsMfaEnabled] = useState(false);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupCodesStatus>({ total: 0, remaining: 0 });

  // Estados do fluxo de Ativação
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollData, setEnrollData] = useState<TotpEnrollmentData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Estados dos Códigos de Backup
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [isRegeneratingBackupCodes, setIsRegeneratingBackupCodes] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);

  // Estados de Desativação
  const [isUnenrollConfirmOpen, setIsUnenrollConfirmOpen] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  // Carregar status do 2FA e códigos de backup
  const loadMfaStatus = async () => {
    try {
      setLoading(true);
      const [status, backupInfo] = await Promise.all([
        getMfaStatus(),
        getBackupCodesStatus().catch(() => ({ total: 0, remaining: 0 })),
      ]);

      const verifiedTotp = status.factors.find(
        (f) => f.factorType === "totp" && f.status === "verified"
      );

      setIsMfaEnabled(!!verifiedTotp);
      setActiveFactorId(verifiedTotp?.id || null);
      setBackupStatus(backupInfo);
    } catch (error: any) {
      console.error("[TwoFactorAuthSettings] Erro ao carregar status do 2FA:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMfaStatus();
  }, []);

  // Iniciar fluxo de cadastro de TOTP
  const handleStartEnrollment = async () => {
    try {
      setIsEnrolling(true);
      setVerificationCode("");
      setShowManualKey(false);
      const data = await enrollTotpFactor("Orion Authenticator");
      setEnrollData(data);
      setIsEnrollModalOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar 2FA",
        description: error.message || "Não foi possível gerar a chave de segurança.",
        variant: "destructive",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  // Confirmar ativação do TOTP com código de 6 dígitos
  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData || !verificationCode) return;

    try {
      setIsVerifying(true);
      await verifyTotpEnrollment(enrollData.factorId, verificationCode);

      // Gerar e salvar códigos de backup
      const codes = generateBackupCodes(8);
      await saveBackupCodes(codes);

      setNewBackupCodes(codes);
      setIsEnrollModalOpen(false);
      setIsBackupModalOpen(true);

      toast({
        title: "2FA Ativado com Sucesso!",
        description: "A autenticação em dois fatores agora protege sua conta.",
      });

      await loadMfaStatus();
    } catch (error: any) {
      toast({
        title: "Código inválido",
        description: "O código digitado está incorreto ou expirou. Verifique o horário do seu celular e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Regerar códigos de backup
  const handleRegenerateBackupCodes = async () => {
    try {
      setIsRegeneratingBackupCodes(true);
      const codes = generateBackupCodes(8);
      await saveBackupCodes(codes);

      setNewBackupCodes(codes);
      setIsRegenerateConfirmOpen(false);
      setIsBackupModalOpen(true);

      toast({
        title: "Novos Códigos Gerados",
        description: "Os códigos de recuperação anteriores foram invalidados.",
      });

      await loadMfaStatus();
    } catch (error: any) {
      toast({
        title: "Erro ao gerar códigos",
        description: error.message || "Não foi possível salvar os novos códigos de backup.",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingBackupCodes(false);
    }
  };

  // Desativar 2FA
  const handleUnenroll = async () => {
    if (!activeFactorId) return;

    try {
      setIsUnenrolling(true);
      await unenrollTotpFactor(activeFactorId);
      setIsUnenrollConfirmOpen(false);

      toast({
        title: "2FA Desativado",
        description: "A autenticação em dois fatores foi desativada da sua conta.",
      });

      await loadMfaStatus();
    } catch (error: any) {
      toast({
        title: "Erro ao desativar 2FA",
        description: error.message || "Ocorreu um erro ao desvincular o autenticador.",
        variant: "destructive",
      });
    } finally {
      setIsUnenrolling(false);
    }
  };

  // Copiar chave secreta
  const handleCopySecret = () => {
    if (!enrollData?.secret) return;
    navigator.clipboard.writeText(enrollData.secret);
    setCopiedSecret(true);
    toast({
      title: "Chave Copiada",
      description: "A chave secreta foi copiada para a área de transferência.",
    });
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // Copiar todos os códigos de backup
  const handleCopyAllBackupCodes = () => {
    if (newBackupCodes.length === 0) return;
    const text = newBackupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    toast({
      title: "Códigos Copiados",
      description: "Todos os códigos de backup foram copiados para a área de transferência.",
    });
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Carregando status de segurança 2FA...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Obrigatoriedade/Recomendação para Gestores e Desenvolvedores */}
      {isRequiredRole && !isMfaEnabled && (
        <div className="relative overflow-hidden p-4 sm:p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 backdrop-blur-sm transition-all duration-300">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Segurança Requerida: 2FA
                </h4>
                <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold">
                  {role === "developer" ? "Desenvolvedor" : "Gestor / Administrador"}
                </Badge>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                Sua conta possui acesso administrativo e de engenharia ao Orion System. A ativação da
                <strong> Autenticação em Dois Fatores (2FA)</strong> é necessária para proteger credenciais de infraestrutura e execução remota.
              </p>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleStartEnrollment}
                  disabled={isEnrolling}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm h-8 text-xs font-semibold gap-1.5"
                >
                  {isEnrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                  Ativar 2FA Agora
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Principal de Gerenciamento do 2FA */}
      <Card className="overflow-hidden border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Autenticação em Dois Fatores (2FA TOTP)
              </CardTitle>
              <CardDescription>
                Adicione uma camada extra de segurança à sua conta exigindo um código do seu celular ao fazer login.
              </CardDescription>
            </div>
            <Badge
              variant={isMfaEnabled ? "default" : "secondary"}
              className={cn(
                "w-fit px-3 py-1 text-xs font-medium flex items-center gap-1.5",
                isMfaEnabled
                  ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {isMfaEnabled ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  2FA Ativo
                </>
              ) : (
                <>
                  <Shield className="h-3.5 w-3.5" />
                  2FA Inativo
                </>
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {!isMfaEnabled ? (
            /* Estado Inativo */
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
                    <p className="font-medium text-foreground text-sm">
                      Como funciona o 2FA via Aplicativo Autenticador?
                    </p>
                    <p>
                      Você utilizará um aplicativo como <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, <strong>1Password</strong> ou <strong>Authy</strong> no seu smartphone. Ao fazer login, você precisará informar sua senha usual e o código de 6 dígitos gerado em tempo real pelo app.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleStartEnrollment}
                  disabled={isEnrolling}
                  className="gap-2"
                >
                  {isEnrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  Configurar Autenticação em Dois Fatores
                </Button>
              </div>
            </div>
          ) : (
            /* Estado Ativo */
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Informação do Autenticador */}
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold text-foreground">Aplicativo Autenticador (TOTP)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Seu dispositivo autenticador está vinculado e ativo para todas as sessões de login no sistema.
                  </p>
                </div>

                {/* Status dos Códigos de Backup */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Códigos de Recuperação</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {backupStatus.remaining} / {backupStatus.total || 8} restantes
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {backupStatus.remaining === 0
                      ? "Você não possui mais códigos de recuperação disponíveis. Gere novos códigos imediatamente."
                      : "Utilize estes códigos caso você perca temporariamente o acesso ao seu celular."}
                  </p>
                </div>
              </div>

              {/* Ações para 2FA Ativo */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRegenerateConfirmOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  Gerar Novos Códigos de Backup
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsUnenrollConfirmOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Desativar 2FA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Ativação do 2FA (QR Code + Verificação) */}
      <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <QrCode className="h-5 w-5 text-primary" />
              Configurar Aplicativo Autenticador
            </DialogTitle>
            <DialogDescription>
              Abra seu app autenticador favorito (Google Authenticator, Microsoft Authenticator, etc.) e escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>

          {enrollData && (
            <div className="space-y-5 py-2">
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-950 rounded-xl border border-border shadow-inner">
                {enrollData.qrCode.startsWith("data:image") || enrollData.qrCode.startsWith("http") ? (
                  <img
                    src={enrollData.qrCode}
                    alt="QR Code TOTP"
                    className="w-48 h-48 object-contain rounded-lg"
                  />
                ) : (
                  <div
                    className="w-48 h-48 flex items-center justify-center bg-white p-2 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(enrollData.qrCode, { USE_PROFILES: { svg: true } }) }}
                  />
                )}
                <span className="text-[11px] text-muted-foreground mt-2">
                  Orion System • {profile?.email || "Conta"}
                </span>
              </div>

              {/* Chave de Entrada Manual */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    Não consegue escanear? Digite a chave manual:
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowManualKey(!showManualKey)}
                  >
                    {showManualKey ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showManualKey ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>

                {showManualKey && (
                  <div className="flex items-center gap-2 pt-1">
                    <code className="flex-1 p-2 bg-background rounded border border-border font-mono text-xs text-center font-bold tracking-wider select-all text-primary">
                      {enrollData.secret}
                    </code>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={handleCopySecret}
                        >
                          {copiedSecret ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copiar Chave Secreta</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Formulário de Validação dos 6 Dígitos */}
              <form onSubmit={handleVerifyEnrollment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfa-verify-code" className="text-sm font-semibold">
                    Código de Confirmação (6 dígitos)
                  </Label>
                  <Input
                    id="mfa-verify-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    className="text-center font-mono text-xl tracking-[0.3em] font-bold h-12"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Digite o código de 6 dígitos que aparece no seu aplicativo autenticador.
                  </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEnrollModalOpen(false)}
                    disabled={isVerifying}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="gap-1.5"
                  >
                    {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar e Ativar 2FA
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Exibição dos Códigos de Backup Recém-Gerados */}
      <Dialog open={isBackupModalOpen} onOpenChange={setIsBackupModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-600 dark:text-amber-400">
              <KeyRound className="h-5 w-5" />
              Guarde seus Códigos de Recuperação
            </DialogTitle>
            <DialogDescription>
              Se você perder o acesso ao seu celular, estes códigos permitirão que você recupere o acesso à sua conta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                Aviso Importante:
              </p>
              <p>
                Cada código pode ser usado <strong>apenas uma vez</strong>. Salve-os em um gerenciador de senhas seguro ou baixe o arquivo de texto. Eles não serão mostrados novamente.
              </p>
            </div>

            {/* Grid dos Códigos */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-muted/50 rounded-xl border border-border">
              {newBackupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-background border border-border/80 font-mono text-xs font-bold text-foreground"
                >
                  <span className="text-muted-foreground text-[10px] select-none mr-2">
                    #{(idx + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="tracking-wider">{code}</span>
                </div>
              ))}
            </div>

            {/* Ações de Cópia e Download */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyAllBackupCodes}
                className="flex-1 gap-1.5 text-xs"
              >
                {copiedCodes ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCodes ? "Copiados!" : "Copiar Códigos"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadBackupCodesAsText(newBackupCodes, profile?.email)}
                className="flex-1 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar Arquivo (.txt)
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => setIsBackupModalOpen(false)}
            >
              Entendi e Guardei os Códigos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Regeração de Códigos de Backup */}
      <AlertDialog open={isRegenerateConfirmOpen} onOpenChange={setIsRegenerateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-5 w-5" />
              Regerar Códigos de Recuperação?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao gerar um novo conjunto de códigos de backup, todos os códigos anteriores serão
              <strong> invalidados imediatamente</strong>. Você deverá guardar os novos códigos em um local seguro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegeneratingBackupCodes}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateBackupCodes}
              disabled={isRegeneratingBackupCodes}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isRegeneratingBackupCodes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sim, Regerar Códigos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Desativação do 2FA */}
      <AlertDialog open={isUnenrollConfirmOpen} onOpenChange={setIsUnenrollConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Desativar Autenticação em Dois Fatores?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao desativar o 2FA, sua conta voltará a ser protegida apenas pela senha, ficando mais vulnerável a ataques.
              Todos os seus códigos de recuperação também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnenrolling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={isUnenrolling}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isUnenrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Desativar 2FA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
