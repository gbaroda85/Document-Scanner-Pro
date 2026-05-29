import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

export function useTesseract() {
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [progress, setProgress] = useState(0);

  const init = useCallback(async () => {
    if (isReady || isInitializing) return;
    setIsInitializing(true);
    try {
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      workerRef.current = worker;
      setIsReady(true);
    } finally {
      setIsInitializing(false);
    }
  }, [isReady, isInitializing]);

  const recognize = useCallback(async (imageData: string): Promise<string> => {
    if (!workerRef.current) await init();
    setIsRecognizing(true);
    setProgress(0);
    try {
      const result = await workerRef.current!.recognize(imageData);
      return result.data.text;
    } finally {
      setIsRecognizing(false);
      setProgress(0);
    }
  }, [init]);

  return { init, recognize, isInitializing, isReady, isRecognizing, progress };
}
