import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { comprimirImagem } from '@/lib/comprimirImagem';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  fullName: string;
  onUploadComplete?: (url: string) => void;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  userId,
  currentAvatarUrl,
  fullName,
  onUploadComplete
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const queryClient = useQueryClient();

  // O perfil chega depois do primeiro render; acompanha quando carregar.
  useEffect(() => { setAvatarUrl(currentAvatarUrl); }, [currentAvatarUrl]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação de tipo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione apenas arquivos de imagem.',
        variant: 'destructive'
      });
      return;
    }

    // Validação de tamanho (max 10MB; a imagem é reduzida antes do envio)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 10MB.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      const comprimido = await comprimirImagem(file, { ladoMaximo: 512 });
      const fileExt = comprimido.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, comprimido, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Adicionar timestamp para cache busting
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      
      // Guarda no perfil para a foto continuar lá depois de recarregar. O
      // ?t= fica salvo de propósito: o arquivo tem sempre o mesmo nome, e sem
      // ele o navegador mostraria a foto antiga do cache.
      const { error: perfilError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithTimestamp })
        .eq('id', userId);
      if (perfilError) throw perfilError;
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });

      setAvatarUrl(urlWithTimestamp);
      onUploadComplete?.(urlWithTimestamp);

      toast({
        title: 'Sucesso',
        description: 'Foto de perfil atualizada com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a foto de perfil.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage src={avatarUrl || undefined} alt={fullName} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
            {fullName ? getInitials(fullName) : <User className="h-8 w-8" />}
          </AvatarFallback>
        </Avatar>
        
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          className="absolute bottom-0 right-0 rounded-full shadow-md opacity-70 hover:opacity-100 group-hover:opacity-100 transition-opacity"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Alterar foto de perfil"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Foto de Perfil</p>
        <p className="text-xs text-muted-foreground">
          Clique no ícone da câmera para alterar
        </p>
      </div>
    </div>
  );
};
