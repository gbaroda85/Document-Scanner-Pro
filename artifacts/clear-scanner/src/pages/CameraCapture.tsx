import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Camera, FlipHorizontal, Flashlight, ZapOff } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { detectDocumentEdges } from '../utils/imageProcessing';

export default function CameraCapture() {
  const [, navigate] = useLocation();
  const { videoRef, isActive, isFront, error, startCamera, stopCamera, captureFrame, flipCamera, toggleTorch } = useCamera();
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const autoDetectRef = useRef<number>(0);
  const [autoCapture, setAutoCapture] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [docDetected, setDocDetected] = useState(false);
  const autoHoldRef = useRef(0);

  useEffect(() => {
    startCamera(false);
    return () => stopCamera();
  }, []);

  const drawOverlay = useCallback(() => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = video.videoWidth;
    tmpCanvas.height = video.videoHeight;
    tmpCanvas.getContext('2d')!.drawImage(video, 0, 0);
    const imgData = tmpCanvas.getContext('2d')!.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
    const corners = detectDocumentEdges(imgData);

    if (corners && corners.length === 4) {
      setDocDetected(true);
      ctx.strokeStyle = '#00c8b4';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00c8b4';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.forEach(c => ctx.lineTo(c.x, c.y));
      ctx.closePath();
      ctx.stroke();

      corners.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#00c8b4';
        ctx.fill();
      });

      if (autoCapture) {
        autoHoldRef.current++;
        if (autoHoldRef.current > 15) {
          autoHoldRef.current = 0;
          handleCapture();
          return;
        }
      }
    } else {
      setDocDetected(false);
      autoHoldRef.current = 0;
    }

    autoDetectRef.current = requestAnimationFrame(drawOverlay);
  }, [autoCapture]);

  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => {
      autoDetectRef.current = requestAnimationFrame(drawOverlay);
    }, 500);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(autoDetectRef.current);
    };
  }, [isActive, drawOverlay]);

  const handleCapture = () => {
    const frame = captureFrame();
    if (!frame) return;
    stopCamera();
    (window as any).__cropState = { imageData: frame };
    navigate('/crop');
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      stopCamera();
      (window as any).__cropState = { imageData: dataUrl };
      navigate('/crop');
    };
    reader.readAsDataURL(file);
  };

  const handleTorch = async () => {
    await toggleTorch();
    setTorchOn(v => !v);
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4 pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={() => { stopCamera(); navigate('/'); }} className="p-2 rounded-full bg-black/40 backdrop-blur-sm text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoCapture(v => !v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              autoCapture ? 'bg-teal-500 text-white' : 'bg-black/40 text-white/80'
            }`}
          >
            Auto
          </button>
          <button onClick={handleTorch} className="p-2 rounded-full bg-black/40 backdrop-blur-sm text-white">
            {torchOn ? <ZapOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white text-center p-8">
            <div>
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium mb-2">Camera Unavailable</p>
              <p className="text-sm opacity-60">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            {docDetected && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-teal-500/90 text-white text-xs px-3 py-1 rounded-full">
                Document detected
              </div>
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-8 pb-10 pt-4 bg-gradient-to-t from-black/80 to-transparent">
        <label className="cursor-pointer p-3 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors">
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </label>
        <button
          onClick={handleCapture}
          className="w-18 h-18 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ width: 72, height: 72 }}
        >
          <div className="w-16 h-16 rounded-full border-4 border-gray-200 bg-teal-500" />
        </button>
        <button onClick={flipCamera} className="p-3 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors">
          <FlipHorizontal className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
