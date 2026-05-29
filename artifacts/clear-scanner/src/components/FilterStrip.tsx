import React, { useRef, useEffect, useCallback } from 'react';
import type { FilterType } from '../types';
import { applyFilter, imageToCanvas } from '../utils/imageProcessing';

interface FilterStripProps {
  imageData: string;
  selectedFilter: FilterType;
  onSelectFilter: (f: FilterType) => void;
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'magic', label: 'Magic' },
  { id: 'docs', label: 'Docs' },
  { id: 'clear', label: 'Clear' },
  { id: 'grayscale', label: 'B&W' },
];

function FilterThumbnail({ imageData, filter, selected, onSelect }: {
  imageData: string;
  filter: FilterType;
  selected: boolean;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    imageToCanvas(imageData).then(src => {
      if (cancelled || !canvasRef.current) return;
      const dst = canvasRef.current;
      applyFilter(dst, src, filter, 100, 100, 0);
    });
    return () => { cancelled = true; };
  }, [imageData, filter]);

  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 flex-shrink-0 focus:outline-none group`}
    >
      <div className={`rounded-lg overflow-hidden border-2 transition-all duration-200 ${
        selected ? 'border-teal-500 shadow-lg shadow-teal-500/25' : 'border-transparent hover:border-teal-400/50'
      }`}>
        <canvas
          ref={canvasRef}
          width={64}
          height={80}
          className="w-16 h-20 object-cover block"
          style={{ imageRendering: 'auto' }}
        />
      </div>
      <span className={`text-xs font-medium transition-colors ${
        selected ? 'text-teal-400' : 'text-muted-foreground group-hover:text-foreground'
      }`}>
        {FILTERS.find(f => f.id === filter)?.label}
      </span>
    </button>
  );
}

export function FilterStrip({ imageData, selectedFilter, onSelectFilter }: FilterStripProps) {
  return (
    <div className="flex gap-3 px-4 overflow-x-auto pb-2 scrollbar-hide">
      {FILTERS.map(f => (
        <FilterThumbnail
          key={f.id}
          imageData={imageData}
          filter={f.id}
          selected={selectedFilter === f.id}
          onSelect={() => onSelectFilter(f.id)}
        />
      ))}
    </div>
  );
}
