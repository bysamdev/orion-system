import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Hash, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCreatePackage, SHA256_REGEX, type PackageType } from '@/hooks/usePatchManagement';

interface Props {
  open: boolean;
  companyId: string;
  userId?: string;
  onClose: () => void;
}

export const NewPackageDialog: React.FC<Props> = ({ open, companyId, userId, onClose }) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PackageType>('powershell');
  const [hash, setHash] = useState('');
  const [filePath, setFilePath] = useState('');

  const createMutation = useCreatePackage(companyId);

  const reset = () => { setName(''); setDescription(''); setType('powershell'); setHash(''); setFilePath(''); };

  const handleSave = () => {
    if (!name.trim() || !hash.trim()) {
      toast({ title: 'Preencha nome e hash SHA-256', variant: 'destructive' });
      return;
    }
    if (!SHA256_REGEX.test(hash.trim())) {
      toast({ title: 'Hash SHA-256 inválido', description: 'Deve ter 64 caracteres hexadecimais.', variant: 'destructive' });
      return;
    }
    createMutation.mutate(
      { name: name.trim(), description: description.trim(), type, file_path: filePath.trim(), sha256_hash: hash.trim(), created_by: userId },
      {
        onSuccess: () => { toast({ title: 'Pacote cadastrado!' }); reset(); onClose(); },
        onError: (err: any) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo Pacote de Software
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Instalar Chrome Enterprise" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Tipo</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                  <SelectItem value="batch">Batch</SelectItem>
                  <SelectItem value="installer">Instalador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o que este pacote faz..." className="resize-none h-20" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Caminho do Arquivo (Storage)</Label>
            <Input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder="Ex: orion-packages/chrome-enterprise.msi" className="font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-3.5 h-3.5" /> Hash SHA-256 *
            </Label>
            <Input
              value={hash}
              onChange={e => setHash(e.target.value)}
              placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
              className={cn('font-mono text-xs', hash && !SHA256_REGEX.test(hash) && 'border-red-500')}
            />
            <p className="text-[10px] text-muted-foreground">
              Execute <code className="bg-muted px-1 rounded">Get-FileHash arquivo.msi -Algorithm SHA256</code> no PowerShell para obter o hash.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O agente Orion verificará o hash SHA-256 antes de qualquer execução. Se não corresponder, o arquivo será descartado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cadastrar Pacote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
