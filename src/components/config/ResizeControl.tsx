/**
 * ResizeControl: max edge dimension input for pre-encode downscaling.
 * 0 = disabled. Otherwise clamps to RESIZE_MAX_EDGE range.
 */

import { Maximize2 } from 'lucide-react';
import { RESIZE_MAX_EDGE_MAX } from '../../constants/index';

interface ResizeControlProps {
  value: number;
  onChange: (value: number) => void;
}

export const ResizeControl: React.FC<ResizeControlProps> = ({ value, onChange }) => {
  const isEnabled = value > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Maximize2 size={14} className="text-muted-foreground" />
          <label
            htmlFor="resize-input"
            className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
          >
            Max Edge
          </label>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={() => onChange(isEnabled ? 0 : 2048)}
            className="sr-only"
            aria-label="Enable resize"
          />
          <span
            className={`inline-flex items-center w-8 h-4 rounded-full border-2 transition-colors shrink-0 p-0.5 ${
              isEnabled ? 'bg-primary border-primary' : 'bg-muted border-border'
            }`}
            aria-hidden
          >
            <span
              className={`w-3 h-3 rounded-full bg-surface border border-border shadow-sm shrink-0 transition-transform duration-200 ease-out ${
                isEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
            {isEnabled ? 'On' : 'Off'}
          </span>
        </label>
      </div>
      {isEnabled && (
        <div className="flex items-center gap-3">
          <input
            id="resize-input"
            type="number"
            min={100}
            max={RESIZE_MAX_EDGE_MAX}
            step={100}
            value={value}
            onChange={(e) => {
              const v = Math.min(RESIZE_MAX_EDGE_MAX, Math.max(100, Number(e.target.value) || 100));
              onChange(v);
            }}
            className="w-24 px-3 py-2 text-sm font-mono rounded-lg border border-border
              bg-input text-foreground
              focus:ring-2 focus:ring-ring/30 focus:border-primary outline-none"
            aria-label="Maximum edge dimension in pixels"
          />
          <span className="text-[10px] text-muted-foreground font-medium">
            px (longest edge)
          </span>
        </div>
      )}
    </div>
  );
};
