/**
 * Results table: queue items, format chips, download links, remove button.
 * Uses status/format constants for badges and labels.
 */

import { BYTES_PER_KB, STATUS_SUCCESS, STATUS_ERROR } from '../constants/index';
import type { ImageItem } from '../lib/queue/types';
import { Sparkles, Download, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';

const DOWNLOAD_EXT_JPEG = 'jpg';

export interface ResultsTableProps {
  items: ImageItem[];
  savingsPercent: string;
  hasFinishedItems: boolean;
  onClearFinished: () => void;
  onDownloadAll: () => void;
  onClear: () => void;
  onRemoveItem: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  items,
  savingsPercent,
  hasFinishedItems,
  onClearFinished,
  onDownloadAll,
  onClear,
  onRemoveItem,
  onPreview,
}) => {
  if (items.length === 0) return null;

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

      <CardContent className="p-0 overflow-x-auto">
        <Table className="text-left min-w-[700px]" aria-label="Processing queue with file names, sizes, and download links">
          <TableHeader className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest sticky top-0 z-10 border-b border-border backdrop-blur-sm">
            <TableRow>
              <TableHead className="px-8 py-4">File Name</TableHead>
              <TableHead className="px-6 py-4">Original</TableHead>
              <TableHead className="px-6 py-4">Status & Formats</TableHead>
              <TableHead className="px-8 py-4 text-right pr-12">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50 bg-surface/20">
            {items.map(item => (
              <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors duration-200">
                <TableCell className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-200 shadow-sm">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Sparkles size={18} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate max-w-[150px] md:max-w-[250px]">
                        {item.file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono tracking-tighter uppercase">
                        {item.originalFormat}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-5 text-xs font-medium text-muted-foreground">
                  {(item.originalSize / BYTES_PER_KB).toFixed(1)} KB
                </TableCell>
                <TableCell className="px-6 py-5">
                  <div className="flex flex-wrap gap-2">
                    {Object.values(item.results).map(res => {
                      const chipClassName = cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors duration-200',
                        res.status === STATUS_SUCCESS
                          ? 'bg-surface border-border shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-md cursor-pointer'
                          : 'bg-muted/50 border-border opacity-60 cursor-default'
                      );
                      const downloadFilename = `tinyimg-${item.file.name.substring(0, item.file.name.lastIndexOf('.'))}.${res.format === 'jpeg' ? DOWNLOAD_EXT_JPEG : res.format}`;
                      return res.status === STATUS_SUCCESS ? (
                        <a
                          key={res.format}
                          href={res.downloadUrl}
                          download={downloadFilename}
                          className={chipClassName}
                          aria-label={`Download ${res.label ?? res.format}`}
                          onContextMenu={(e) => {
                            if (onPreview) {
                              e.preventDefault();
                              onPreview(item, res.format);
                            }
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
                              {res.label ?? res.format}
                            </span>
                            <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {res.size != null
                                ? (res.size / BYTES_PER_KB).toFixed(1)
                                : '—'}{' '}
                              KB
                            </span>
                            {res.size != null && (
                              <span className="text-[9px] font-black text-success bg-success/15 px-1.5 py-0.5 rounded-full">
                                -
                                {Math.abs(
                                  ((item.originalSize - res.size) / item.originalSize) * 100
                                ).toFixed(0)}
                                %
                              </span>
                            )}
                            </div>
                          </div>
                            <Download size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </a>
                      ) : (
                        <div key={res.format} className={chipClassName}>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
                              {res.label ?? res.format}
                            </span>
                            {res.status === STATUS_ERROR ? (
                              <Badge variant="error" className="text-[9px] px-2 py-1 rounded-full italic">
                                Error
                              </Badge>
                            ) : (
                              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-primary animate-pulse-subtle"
                                  style={{ width: '40%' }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="px-8 py-5 text-right pr-12 align-middle">
                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(item.id)}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors duration-200"
                      title="Remove item"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
