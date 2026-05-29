import React from 'react';
import { Slider } from '@/components/ui/slider';

interface AdjustmentSlidersProps {
  brightness: number;
  contrast: number;
  sharpness: number;
  onBrightness: (v: number) => void;
  onContrast: (v: number) => void;
  onSharpness: (v: number) => void;
}

function SliderRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
      <Slider
        min={min} max={max} step={1} value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground w-8 text-right">{value}</span>
    </div>
  );
}

export function AdjustmentSliders({
  brightness, contrast, sharpness, onBrightness, onContrast, onSharpness
}: AdjustmentSlidersProps) {
  return (
    <div className="px-4 space-y-3">
      <SliderRow label="Brightness" value={brightness} min={0} max={200} onChange={onBrightness} />
      <SliderRow label="Contrast" value={contrast} min={0} max={200} onChange={onContrast} />
      <SliderRow label="Sharpness" value={sharpness} min={0} max={100} onChange={onSharpness} />
    </div>
  );
}
