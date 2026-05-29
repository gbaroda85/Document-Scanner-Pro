import { useRef, useState, useCallback } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isFront, setIsFront] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (front = false) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: front ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setIsFront(front);
      setError(null);
    } catch (e) {
      setError('Camera access denied or not available.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsActive(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  }, []);

  const flipCamera = useCallback(() => {
    startCamera(!isFront);
  }, [isFront, startCamera]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    if (!caps.torch) return;
    const settings = track.getSettings() as MediaTrackSettings & { torch?: boolean };
    await track.applyConstraints({ advanced: [{ torch: !settings.torch } as MediaTrackConstraintSet] });
  }, []);

  return { videoRef, isActive, isFront, error, startCamera, stopCamera, captureFrame, flipCamera, toggleTorch };
}
