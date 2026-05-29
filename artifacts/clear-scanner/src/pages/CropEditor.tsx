import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectDocumentEdges, perspectiveWarp } from '../utils/imageProcessing';

interface CropState {
  imageData: string;
  docId?: string;
}

export default function CropEditor() {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [corners, setCorners] = useState<{ x: number; y: number }[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [displayScale, setDisplayScale] = useState({ sx: 1, sy: 1, offX: 0, offY: 0 });
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const loupeCanvas = useRef<HTMLCanvasElement>(null);

  const state: CropState = (window as any).__cropState || { imageData: '' };

  useEffect(() => {
    if (!state.imageData) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const container = containerRef.current!;
      const maxW = container.clientWidth;
      const maxH = container.clientHeight;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const dW = img.width * scale;
      const dH = img.height * scale;
      const offX = (maxW - dW) / 2;
      const offY = (maxH - dH) / 2;
      setDisplayScale({ sx: scale, sy: scale, offX, offY });

      const ctx = canvasRef.current!.getContext('2d')!;
      canvasRef.current!.width = maxW;
      canvasRef.current!.height = maxH;

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = img.width; tmpCanvas.height = img.height;
      tmpCanvas.getContext('2d')!.drawImage(img, 0, 0);
      const imgData = tmpCanvas.getContext('2d')!.getImageData(0, 0, img.width, img.height);
      const detected = detectDocumentEdges(imgData);

      const defaultCorners = detected || [
        { x: img.width * 0.1, y: img.height * 0.1 },
        { x: img.width * 0.9, y: img.height * 0.1 },
        { x: img.width * 0.9, y: img.height * 0.9 },
        { x: img.width * 0.1, y: img.height * 0.9 },
      ];
      setCorners(defaultCorners);
    };
    img.src = state.imageData;
  }, [state.imageData]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current || corners.length < 4) return;
    const ctx = canvas.getContext('2d')!;
    const { sx, sy, offX, offY } = displayScale;
    const img = imgRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offX, offY, img.width * sx, img.height * sy);

    const toDisplay = (c: { x: number; y: number }) => ({ x: c.x * sx + offX, y: c.y * sy + offY });
    const dc = corners.map(toDisplay);

    ctx.strokeStyle = 'rgba(0,200,180,0.9)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(dc[0].x, dc[0].y);
    dc.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(dc[0].x, dc[0].y);
    dc.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();

    dc.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = '#00c8b4';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
  }, [corners, displayScale]);

  useEffect(() => { draw(); }, [draw]);

  const getImageCoord = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { sx, sy, offX, offY } = displayScale;
    const px = (clientX - rect.left - offX) / sx;
    const py = (clientY - rect.top - offY) / sy;
    return { px, py };
  };

  const findNearestCorner = (px: number, py: number): number => {
    let nearest = -1, minDist = Infinity;
    corners.forEach((c, i) => {
      const d = Math.sqrt((c.x - px) ** 2 + (c.y - py) ** 2);
      if (d < minDist) { minDist = d; nearest = i; }
    });
    return minDist < 50 ? nearest : -1;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { px, py } = getImageCoord(e.clientX, e.clientY);
    const idx = findNearestCorner(px, py);
    if (idx >= 0) {
      setDragging(idx);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging === null) return;
    const { px, py } = getImageCoord(e.clientX, e.clientY);
    const img = imgRef.current!;
    const newCorners = corners.map((c, i) =>
      i === dragging ? { x: Math.max(0, Math.min(img.width, px)), y: Math.max(0, Math.min(img.height, py)) } : c
    );
    setCorners(newCorners);

    const { sx, sy, offX, offY } = displayScale;
    const cx = px * sx + offX;
    const cy = py * sy + offY;
    setLoupePos({ x: cx, y: cy, px, py });

    if (loupeCanvas.current && imgRef.current) {
      const lctx = loupeCanvas.current.getContext('2d')!;
      loupeCanvas.current.width = 100;
      loupeCanvas.current.height = 100;
      lctx.save();
      lctx.beginPath();
      lctx.arc(50, 50, 50, 0, Math.PI * 2);
      lctx.clip();
      const zoomFactor = 3;
      lctx.drawImage(imgRef.current, px - 25 / zoomFactor, py - 25 / zoomFactor, 50 / zoomFactor, 50 / zoomFactor, 0, 0, 100, 100);
      lctx.strokeStyle = '#00c8b4';
      lctx.lineWidth = 2;
      lctx.beginPath();
      lctx.moveTo(50, 35); lctx.lineTo(50, 65);
      lctx.moveTo(35, 50); lctx.lineTo(65, 50);
      lctx.stroke();
      lctx.restore();
    }
  };

  const onPointerUp = () => {
    setDragging(null);
    setLoupePos(null);
  };

  const handleReset = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    setCorners([
      { x: img.width * 0.1, y: img.height * 0.1 },
      { x: img.width * 0.9, y: img.height * 0.1 },
      { x: img.width * 0.9, y: img.height * 0.9 },
      { x: img.width * 0.1, y: img.height * 0.9 },
    ]);
  };

  const handleApply = async () => {
    if (!imgRef.current || corners.length < 4) return;
    const src = document.createElement('canvas');
    src.width = imgRef.current.width;
    src.height = imgRef.current.height;
    src.getContext('2d')!.drawImage(imgRef.current, 0, 0);
    const warped = perspectiveWarp(src, corners);
    const resultData = warped.toDataURL('image/jpeg', 0.95);
    (window as any).__cropResult = resultData;
    (window as any).__cropDocId = state.docId;
    navigate('/editor');
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-sm">Adjust Borders</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={handleApply} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Check className="w-4 h-4 mr-1" /> Apply
          </Button>
        </div>
      </header>
      <div className="text-center py-2 text-xs text-muted-foreground">
        Drag the corner handles to adjust document borders
      </div>
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        {loupePos && (
          <div
            className="absolute pointer-events-none z-20"
            style={{ left: loupePos.x - 70, top: loupePos.y - 130, width: 100, height: 100 }}
          >
            <canvas ref={loupeCanvas} width={100} height={100} className="rounded-full border-2 border-teal-400 shadow-lg" />
          </div>
        )}
      </div>
    </div>
  );
}
