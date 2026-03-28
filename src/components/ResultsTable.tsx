import React from 'react';
import { Download, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Table, TableHead, TableHeader, TableRow } from './ui/table';
import { VirtualizedTableBody } from './results/VirtualizedTableBody';
import type { ImageItem } from '@/lib/queue/types';

export interface ResultsTableProps {
  itemIds: string[];
  savingsPercent: string;
  hasFinishedItems: boolean;
  onClearFinished: () => void;
  onDownloadAll: () => void;
  onClear: () => void;
  onRemoveItem: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  itemIds,
  savingsPercent,
  hasFinishedItems,
  onClearFinished,
  onDownloadAll,
  onClear,
  onRemoveItem,
  onPreview,
}) => {
  if (itemIds.length === 0) return null;

  return (
    <Card className="glass rounded-3xl overflow-hidden border border-border/70 shadow-2xl shadow-primary/5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="px-6 md:px-8 py-5 md:py-6 bg-surface/50 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Processing Queue</h3>
          <p className="text-sm text-muted-foreground">Wait for completion to batch download.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-4 text-sm w-full sm:w-auto justify-center sm:justify-end">
          <div className="text-center sm:text-right hidden sm:block mr-4">
            <p className="text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Total Savings</p>
            <p
              className={cn(
                'font-black text-xl leading-none mt-1',
                Number(savingsPercent) > 0 ? 'text-success' : 'text-warning'
              )}
            >
              {Number(savingsPercent) > 0 ? '-' : '+'}
              {Math.abs(Number(savingsPercent))}%
            </p>
          </div>
          {hasFinishedItems ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onClearFinished}
              className="font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              title="Clear Optimized"
              aria-label="Clear completed items from queue"
            >
              <CheckCircle2 size={16} /> <span className="hidden xl:inline">Clear Optimized</span>
            </Button>
          ) : null}
          <Button
            onClick={onDownloadAll}
            className="py-2 text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-colors duration-200 cursor-pointer"
            aria-label="Download all as ZIP"
          >
            <Download size={18} /> <span className="hidden sm:inline">Download All (ZIP)</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors duration-200"
            title="Clear All"
            aria-label="Clear all items from queue"
          >
            <Trash2 size={20} />
          </Button>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-auto">
          <Table className="text-left min-w-[700px] block" aria-label="Processing queue with file names, sizes, and download links">
            <TableHeader className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest sticky top-0 z-10 border-b border-border backdrop-blur-sm">
              <TableRow>
                <TableHead className="px-8 py-4">File Name</TableHead>
                <TableHead className="px-6 py-4">Original</TableHead>
                <TableHead className="px-6 py-4">Status & Formats</TableHead>
                <TableHead className="px-8 py-4 text-right pr-12">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <VirtualizedTableBody 
              itemIds={itemIds} 
              onRemove={onRemoveItem} 
              onPreview={onPreview} 
            />
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
