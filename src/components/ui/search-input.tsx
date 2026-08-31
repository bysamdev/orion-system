import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, placeholder = "Pesquisar...", ...props }, ref) => {
    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else if (onChange) {
        const event = {
          target: { value: "" },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    return (
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
        <input
          type="text"
          ref={ref}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-label={props["aria-label"] || placeholder}
          className={cn(
            "flex h-9 w-full rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm pl-9 pr-8 py-1 text-sm shadow-xs transition-colors",
            "placeholder:text-muted-foreground/60 text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            aria-label="Limpar pesquisa"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
