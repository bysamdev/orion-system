import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TablePaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const TablePagination = React.forwardRef<HTMLDivElement, TablePaginationProps>(
  (
    {
      className,
      currentPage,
      totalPages,
      totalItems,
      pageSize,
      onPageChange,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const hasNext = currentPage < totalPages;
    const hasPrev = currentPage > 1;

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border/30 text-xs text-muted-foreground",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-1.5">
          {totalItems !== undefined && (
            <span>
              Total de <strong className="text-foreground font-semibold">{totalItems}</strong>{" "}
              {totalItems === 1 ? "registro" : "registros"}
            </span>
          )}
          {totalPages > 1 && (
            <span>
              (Página <strong className="text-foreground font-semibold">{currentPage}</strong> de{" "}
              <strong className="text-foreground font-semibold">{totalPages}</strong>)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={!hasPrev || disabled}
            aria-label="Primeira página"
            title="Primeira página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrev || disabled}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="px-2 font-medium text-foreground">
            {currentPage} / {Math.max(totalPages, 1)}
          </span>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNext || disabled}
            aria-label="Próxima página"
            title="Próxima página"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNext || disabled}
            aria-label="Última página"
            title="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }
);
TablePagination.displayName = "TablePagination";

export { TablePagination };
