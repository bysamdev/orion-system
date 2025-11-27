import React, { useEffect, useCallback } from 'react';

interface ImagePasteHandlerProps {
  onImagePaste: (file: File) => void;
  targetRef?: React.RefObject<HTMLElement>;
  disabled?: boolean;
}

export const ImagePasteHandler: React.FC<ImagePasteHandlerProps> = ({
  onImagePaste,
  targetRef,
  disabled = false
}) => {
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (disabled) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Renomear arquivo colado para ter nome mais descritivo
          const timestamp = Date.now();
          const ext = file.type.split('/')[1] || 'png';
          const renamedFile = new File(
            [file], 
            `imagem-colada-${timestamp}.${ext}`, 
            { type: file.type }
          );
          onImagePaste(renamedFile);
        }
        break;
      }
    }
  }, [onImagePaste, disabled]);

  useEffect(() => {
    const target = targetRef?.current || document;
    
    target.addEventListener('paste', handlePaste as EventListener);
    
    return () => {
      target.removeEventListener('paste', handlePaste as EventListener);
    };
  }, [handlePaste, targetRef]);

  return null;
};
