/**
 * QualitySlider: global compression quality control (1-100).
 * Maps to preset interpolation — see constants/presets.ts for the lerp logic.
 */

import { Gauge } from 'lucide-react';
import { OUTPUT_QUALITY_MIN, OUTPUT_QUALITY_MAX } from '../../constants/index';

interface QualitySliderProps {
  value: number;
  onChange: (value: number) => void;
}

function getQualityLabel(value: number): string {
  if (value >= 90) return 'Balanced (default)';
  if (value >= 70) return 'Aggressive';
  if (value >= 40) return 'Max compression';
  return 'Extreme';
}

export const QualitySlider: React.FC<QualitySliderProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-muted-foreground" />
          <label
            htmlFor="quality-slider"
            className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
          >
            Quality
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground tabular-nums">
            {value}%
          </span>
          <span className="text-[9px] text-muted-foreground font-medium">
            {getQualityLabel(value)}
          </span>
        </div>
      </div>
      <input
        id="quality-slider"
        type="range"
        min={OUTPUT_QUALITY_MIN}
        max={OUTPUT_QUALITY_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:shadow-primary/30 [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
        aria-label="Compression quality"
      />
      <div className="flex justify-between text-[8px] text-muted-foreground/70 font-bold uppercase tracking-widest">
        <span>Smaller</span>
        <span>Higher Quality</span>
      </div>
    </div>
  );
};
