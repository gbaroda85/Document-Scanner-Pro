import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportAsPDF, exportAsImage } from '../utils/exportUtils';
import type { Document as ScanDocument, ExportOptions } from '../types';

interface ExportDialogProps {
  doc: ScanDocument;
  onClose: () => void;
}

export function ExportDialog({ doc, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'pdf' | 'jpeg' | 'png'>('pdf');
  const [quality, setQuality] = useState<'low' | 'medium' | 'highest'>('highest');
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'legal'>('a4');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const opts: ExportOptions = { format, quality, pageSize };
      if (format === 'pdf') {
        await exportAsPDF(doc.pages, doc.title, opts);
      } else {
        const page = doc.pages[0];
        if (page) await exportAsImage(page, format, doc.title);
      }
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const OptionBtn = ({ label, val, current, onClick }: { label: string; val: string; current: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
        current === val ? 'border-teal-500 bg-teal-500/10 text-teal-400 font-medium' : 'border-border text-muted-foreground hover:border-teal-400/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Export Document</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Format</label>
            <div className="flex gap-2">
              <OptionBtn label="PDF" val="pdf" current={format} onClick={() => setFormat('pdf')} />
              <OptionBtn label="JPEG" val="jpeg" current={format} onClick={() => setFormat('jpeg')} />
              <OptionBtn label="PNG" val="png" current={format} onClick={() => setFormat('png')} />
            </div>
          </div>

          {format === 'pdf' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Quality</label>
                <div className="flex gap-2">
                  <OptionBtn label="Low" val="low" current={quality} onClick={() => setQuality('low')} />
                  <OptionBtn label="Medium" val="medium" current={quality} onClick={() => setQuality('medium')} />
                  <OptionBtn label="Highest" val="highest" current={quality} onClick={() => setQuality('highest')} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Page Size</label>
                <div className="flex gap-2">
                  <OptionBtn label="A4" val="a4" current={pageSize} onClick={() => setPageSize('a4')} />
                  <OptionBtn label="Letter" val="letter" current={pageSize} onClick={() => setPageSize('letter')} />
                  <OptionBtn label="Legal" val="legal" current={pageSize} onClick={() => setPageSize('legal')} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {doc.pages.length} page{doc.pages.length !== 1 ? 's' : ''} will be included
              </p>
            </>
          )}

          {format !== 'pdf' && (
            <p className="text-xs text-muted-foreground">First page of the document will be exported</p>
          )}
        </div>

        <div className="px-5 pb-5">
          <Button onClick={handleExport} disabled={exporting} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11">
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? 'Exporting...' : `Download as ${format.toUpperCase()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
