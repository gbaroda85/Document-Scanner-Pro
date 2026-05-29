import React, { useState, useEffect } from 'react';
import { X, Copy, Download, Loader2, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTesseract } from '../hooks/useTesseract';

interface OCRModalProps {
  imageData: string;
  onClose: () => void;
}

export function OCRModal({ imageData, onClose }: OCRModalProps) {
  const { recognize, isInitializing, isRecognizing, progress } = useTesseract();
  const [text, setText] = useState('');
  const [editableText, setEditableText] = useState('');
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  const runOCR = async () => {
    setStarted(true);
    const result = await recognize(imageData);
    setText(result);
    setEditableText(result);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(editableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadText = () => {
    const blob = new Blob([editableText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-text.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = isInitializing || isRecognizing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl w-full max-w-3xl border border-border shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <ScanText className="w-4 h-4 text-teal-400" />
            <h2 className="font-semibold">Text Extraction (OCR)</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0 gap-0">
          <div className="sm:w-2/5 border-b sm:border-b-0 sm:border-r border-border flex-shrink-0">
            <div className="p-3 h-48 sm:h-full overflow-hidden">
              <img src={imageData} alt="Document" className="w-full h-full object-contain rounded-lg" />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {!started ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <ScanText className="w-10 h-10 text-teal-400 mx-auto mb-3 opacity-60" />
                  <p className="text-sm text-muted-foreground mb-4">Extract text from this document page using AI-powered OCR</p>
                  <Button onClick={runOCR} className="bg-teal-600 hover:bg-teal-700 text-white">
                    Start Text Extraction
                  </Button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  {isInitializing ? 'Initializing OCR engine...' : `Recognizing text... ${progress}%`}
                </p>
                {isRecognizing && (
                  <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 p-4">
                <textarea
                  className="flex-1 resize-none bg-muted/50 text-sm rounded-lg p-3 border border-border focus:outline-none focus:border-teal-400 transition-colors font-mono leading-relaxed"
                  value={editableText}
                  onChange={e => setEditableText(e.target.value)}
                  placeholder="Extracted text will appear here..."
                />
              </div>
            )}

            {started && !isLoading && (
              <div className="flex gap-2 px-4 pb-4 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={copyText} className="flex-1">
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadText} className="flex-1">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download .txt
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
