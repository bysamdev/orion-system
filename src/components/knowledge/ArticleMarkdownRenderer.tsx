import React from 'react';
import { 
  AlertCircle, AlertTriangle, CheckCircle2, Info, Image, 
  HelpCircle, Monitor, ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ArticleMarkdownRendererProps {
  content: string;
  onOpenTicket?: () => void;
}

export const ArticleMarkdownRenderer: React.FC<ArticleMarkdownRendererProps> = ({ content, onOpenTicket }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: string[] = [];
  let isNumbered = false;

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      if (isNumbered) {
        elements.push(
          <ol key={key} className="space-y-3 my-4">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/40">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 text-sm text-foreground/90 leading-relaxed font-normal">
                  {renderInlineFormatting(item)}
                </div>
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={key} className="space-y-2 my-3 pl-2">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                <span className="flex-1">{renderInlineFormatting(item)}</span>
              </li>
            ))}
          </ul>
        );
      }
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList(`list-${index}`);
      return;
    }

    // [PRINT: ...] Screenshot callout
    if (trimmed.startsWith('[PRINT:') && trimmed.endsWith(']')) {
      flushList(`list-${index}`);
      const printText = trimmed.slice(7, -1).trim();
      elements.push(
        <div 
          key={`print-${index}`} 
          className="my-5 p-4 rounded-2xl bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 border border-dashed border-border/60 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <Image className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-primary border-primary/30 bg-primary/5">
                Captura de Tela Exibida no Sistema
              </Badge>
            </div>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              {printText}
            </p>
          </div>
        </div>
      );
      return;
    }

    // [CONFIRMAR: ...] Confirmation tag
    if (trimmed.includes('[CONFIRMAR:')) {
      flushList(`list-${index}`);
      const confirmText = trimmed.replace(/.*\[CONFIRMAR:\s*(.*?)\].*/, '$1');
      elements.push(
        <div key={`confirm-${index}`} className="my-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span><strong>Validação interna necessária:</strong> {confirmText}</span>
        </div>
      );
      return;
    }

    // Blockquote alerts: > [!NOTE], > [!WARNING], > [!IMPORTANT]
    if (trimmed.startsWith('>')) {
      flushList(`list-${index}`);
      const quoteText = trimmed.replace(/^>\s*/, '');

      if (quoteText.includes('[!NOTE]') || quoteText.includes('Se o problema persistir') || quoteText.includes('Aviso de Suporte')) {
        const cleanMessage = quoteText.replace(/\[!NOTE\]|\*\*|\*/g, '').trim();
        elements.push(
          <div key={`alert-note-${index}`} className="my-6 p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
              <Info className="w-5 h-5" />
              <span>Precisa de atendimento da equipe de TI?</span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {cleanMessage || 'Se o problema persistir após estes passos, nossa equipe técnica está à disposição para ajudar você.'}
            </p>
            {onOpenTicket && (
              <button
                onClick={onOpenTicket}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
              >
                <HelpCircle className="w-4 h-4" />
                Abrir Chamado no Orion System
              </button>
            )}
          </div>
        );
        return;
      }

      if (quoteText.includes('[!WARNING]') || quoteText.includes('Cuidados com a Segurança') || quoteText.includes('Atenção:')) {
        const cleanMessage = quoteText.replace(/\[!WARNING\]|\[!IMPORTANT\]|\*\*|\*/g, '').trim();
        elements.push(
          <div key={`alert-warn-${index}`} className="my-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-foreground/90">
              <span className="font-bold text-amber-600 dark:text-amber-400 block">Aviso Importante</span>
              <p className="leading-relaxed">{renderInlineFormatting(cleanMessage)}</p>
            </div>
          </div>
        );
        return;
      }

      elements.push(
        <blockquote key={`quote-${index}`} className="my-3 pl-4 border-l-4 border-primary/40 text-xs italic text-muted-foreground">
          {renderInlineFormatting(quoteText)}
        </blockquote>
      );
      return;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      flushList(`list-${index}`);
      elements.push(
        <h1 key={`h1-${index}`} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground my-4 pb-2 border-b border-border/40">
          {renderInlineFormatting(trimmed.replace(/^#\s+/, ''))}
        </h1>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList(`list-${index}`);
      elements.push(
        <h2 key={`h2-${index}`} className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-6 mb-3 flex items-center gap-2">
          {renderInlineFormatting(trimmed.replace(/^##\s+/, ''))}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList(`list-${index}`);
      elements.push(
        <h3 key={`h3-${index}`} className="text-base sm:text-lg font-bold text-foreground mt-4 mb-2 text-primary">
          {renderInlineFormatting(trimmed.replace(/^###\s+/, ''))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('#### ')) {
      flushList(`list-${index}`);
      elements.push(
        <h4 key={`h4-${index}`} className="text-sm font-bold text-foreground mt-3 mb-1">
          {renderInlineFormatting(trimmed.replace(/^----+/, ''))}
        </h4>
      );
      return;
    }

    // Divider
    if (trimmed === '---') {
      flushList(`list-${index}`);
      elements.push(<hr key={`hr-${index}`} className="my-6 border-border/40" />);
      return;
    }

    // Numbered List (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      if (!inList || !isNumbered) {
        flushList(`list-${index}`);
        inList = true;
        isNumbered = true;
      }
      listItems.push(numberedMatch[2]);
      return;
    }

    // Unordered List (- , * )
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      if (!inList || isNumbered) {
        flushList(`list-${index}`);
        inList = true;
        isNumbered = false;
      }
      listItems.push(bulletMatch[1]);
      return;
    }

    // Regular Paragraph
    flushList(`list-${index}`);
    elements.push(
      <p key={`p-${index}`} className="text-sm text-foreground/90 leading-relaxed my-2">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  });

  flushList('final-list');

  return (
    <div className="space-y-1 font-sans">
      {elements}
    </div>
  );
};

// Helper function to render bold, code, and inline formatting
function renderInlineFormatting(text: string): React.ReactNode {
  // Split by bold (**text**) or inline code (`code`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-primary font-semibold">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
