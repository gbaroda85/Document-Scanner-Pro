import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  ArrowLeft, Plus, Trash2, RotateCw, RotateCcw, FileText,
  Download, ScanText, ChevronDown, GripVertical, Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FilterStrip } from '../components/FilterStrip';
import { AdjustmentSliders } from '../components/AdjustmentSliders';
import { ExportDialog } from '../components/ExportDialog';
import { OCRModal } from '../components/OCRModal';
import { getDocument, saveDocument } from '../lib/db';
import { applyFilter, imageToCanvas, rotateImage } from '../utils/imageProcessing';
import type { Document as ScanDocument, ScannedPage, FilterType } from '../types';

function SortablePage({ page, index, selected, onClick, onDelete }: {
  page: ScannedPage; index: number; selected: boolean; onClick: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex-shrink-0 cursor-pointer group ${isDragging ? 'opacity-50 z-50' : ''}`}
      onClick={onClick}
    >
      <div className={`rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-teal-500 shadow-lg shadow-teal-500/25' : 'border-transparent hover:border-teal-400/40'}`}>
        <div className="relative">
          <img src={page.processedImageData} alt={`Page ${index + 1}`} className="w-16 h-20 object-cover block" />
          <div {...listeners} {...attributes} className="absolute top-1 left-1 p-0.5 rounded bg-black/30 text-white cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3 h-3" />
          </div>
          <button
            className="absolute top-1 right-1 p-0.5 rounded bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <div className="bg-card px-1 py-0.5 text-center">
          <span className={`text-xs ${selected ? 'text-teal-400' : 'text-muted-foreground'}`}>{index + 1}</span>
        </div>
      </div>
    </div>
  );
}

export default function DocumentEditor() {
  const [, params] = useRoute('/editor/:id');
  const [, navigate] = useLocation();
  const docId = params?.id;

  const [doc, setDoc] = useState<ScanDocument | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [filter, setFilter] = useState<FilterType>('original');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sharpness, setSharpness] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showSliders, setShowSliders] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const applyTimer = useRef<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        if (docId) {
          const d = await getDocument(docId);
          if (d) { setDoc(d); return; }
        }
        const cropResult = (window as any).__cropResult as string | undefined;
        if (cropResult) {
          const newDoc = await createDocFromCrop(cropResult, (window as any).__cropDocId);
          setDoc(newDoc);
          delete (window as any).__cropResult;
          delete (window as any).__cropDocId;
          return;
        }
        setLoadError(true);
      } catch {
        setLoadError(true);
      }
    };
    load();
  }, [docId]);

  async function createDocFromCrop(imageData: string, existingDocId?: string): Promise<ScanDocument> {
    if (existingDocId) {
      const existing = await getDocument(existingDocId);
      if (existing) {
        const page = makeNewPage(imageData, filter, brightness, contrast, sharpness);
        const updated = { ...existing, pages: [...existing.pages, page], updatedAt: Date.now(), thumbnail: page.processedImageData };
        await saveDocument(updated);
        setCurrentPageIdx(updated.pages.length - 1);
        return updated;
      }
    }
    const page = makeNewPage(imageData, filter, brightness, contrast, sharpness);
    const newDoc: ScanDocument = {
      id: crypto.randomUUID(),
      title: `Document ${new Date().toLocaleDateString()}`,
      folderId: null,
      pages: [page],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      thumbnail: page.processedImageData,
    };
    await saveDocument(newDoc);
    return newDoc;
  }

  function makeNewPage(originalData: string, f: FilterType, b: number, c: number, s: number): ScannedPage {
    return {
      id: crypto.randomUUID(),
      originalImageData: originalData,
      processedImageData: originalData,
      filter: f,
      brightness: b,
      contrast: c,
      sharpness: s,
      rotation: 0,
      createdAt: Date.now(),
    };
  }

  const currentPage = doc?.pages[currentPageIdx];

  useEffect(() => {
    if (!currentPage) return;
    setFilter(currentPage.filter);
    setBrightness(currentPage.brightness);
    setContrast(currentPage.contrast);
    setSharpness(currentPage.sharpness);
  }, [currentPageIdx, currentPage?.id]);

  const renderPreview = useCallback(async (f: FilterType, b: number, c: number, s: number, origData: string) => {
    if (!previewCanvasRef.current || !origData) return;
    const src = await imageToCanvas(origData);
    applyFilter(previewCanvasRef.current, src, f, b, c, s);
  }, []);

  useEffect(() => {
    if (!currentPage) return;
    clearTimeout(applyTimer.current);
    applyTimer.current = window.setTimeout(async () => {
      await renderPreview(filter, brightness, contrast, sharpness, currentPage.originalImageData);
    }, 80);
  }, [filter, brightness, contrast, sharpness, currentPage?.originalImageData]);

  const saveCurrentPageSettings = useCallback(async () => {
    if (!doc || !currentPage || !previewCanvasRef.current) return;
    const processedData = previewCanvasRef.current.toDataURL('image/jpeg', 0.92);
    const updatedPage = { ...currentPage, filter, brightness, contrast, sharpness, processedImageData: processedData };
    const updatedPages = doc.pages.map((p, i) => i === currentPageIdx ? updatedPage : p);
    const updated = { ...doc, pages: updatedPages, updatedAt: Date.now(), thumbnail: updatedPages[0].processedImageData };
    setDoc(updated);
    await saveDocument(updated);
  }, [doc, currentPage, currentPageIdx, filter, brightness, contrast, sharpness]);

  useEffect(() => {
    const t = setTimeout(() => { saveCurrentPageSettings(); }, 800);
    return () => clearTimeout(t);
  }, [filter, brightness, contrast, sharpness]);

  const rotate = async (deg: number) => {
    if (!doc || !currentPage) return;
    const newDeg = (currentPage.rotation + deg + 360) % 360;
    const rotated = await rotateImage(currentPage.originalImageData, newDeg);
    const updatedPage = { ...currentPage, originalImageData: rotated, rotation: 0 };
    const updatedPages = doc.pages.map((p, i) => i === currentPageIdx ? updatedPage : p);
    const updated = { ...doc, pages: updatedPages, updatedAt: Date.now() };
    setDoc(updated);
    await saveDocument(updated);
  };

  const deletePage = async (idx: number) => {
    if (!doc) return;
    const newPages = doc.pages.filter((_, i) => i !== idx);
    if (newPages.length === 0) { navigate('/'); return; }
    const updated = { ...doc, pages: newPages, updatedAt: Date.now(), thumbnail: newPages[0].processedImageData };
    setDoc(updated);
    await saveDocument(updated);
    setCurrentPageIdx(Math.min(idx, newPages.length - 1));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!doc) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = doc.pages.findIndex(p => p.id === active.id);
    const newIdx = doc.pages.findIndex(p => p.id === over.id);
    const reordered = arrayMove(doc.pages, oldIdx, newIdx);
    const updated = { ...doc, pages: reordered, updatedAt: Date.now() };
    setDoc(updated);
    await saveDocument(updated);
    setCurrentPageIdx(newIdx);
  };

  const addPage = () => {
    if (!doc) return;
    (window as any).__cropState = { imageData: '', docId: doc.id };
    navigate('/camera');
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">Document not found</p>
          <p className="text-sm mb-4 opacity-60">It may have been deleted or didn't save correctly.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-muted-foreground">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-sm flex-1 truncate">{doc.title}</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="px-2" onClick={() => setShowOCR(true)}>
            <ScanText className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="px-2" onClick={() => setShowExport(true)}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center bg-muted/30 relative min-h-0 p-4">
          {currentPage && (
            <canvas
              ref={previewCanvasRef}
              className="max-w-full max-h-full rounded-lg shadow-xl object-contain"
              style={{ maxHeight: '100%', maxWidth: '100%' }}
            />
          )}
          <div className="absolute bottom-3 right-3 flex gap-1">
            <button onClick={() => rotate(-90)} className="p-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border hover:bg-card transition-colors shadow-sm">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => rotate(90)} className="p-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border hover:bg-card transition-colors shadow-sm">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-shrink-0 bg-card border-t border-border">
          <div className="flex gap-2 px-4 py-2 overflow-x-auto items-center">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={doc.pages.map(p => p.id)} strategy={horizontalListSortingStrategy}>
                {doc.pages.map((page, idx) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    index={idx}
                    selected={idx === currentPageIdx}
                    onClick={() => setCurrentPageIdx(idx)}
                    onDelete={() => deletePage(idx)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              onClick={addPage}
              className="flex-shrink-0 w-16 h-20 rounded-lg border-2 border-dashed border-border hover:border-teal-400 text-muted-foreground hover:text-teal-400 transition-all flex items-center justify-center"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {currentPage && (
            <div className="py-2 space-y-2">
              <FilterStrip
                imageData={currentPage.originalImageData}
                selectedFilter={filter}
                onSelectFilter={setFilter}
              />
              <button
                onClick={() => setShowSliders(v => !v)}
                className="flex items-center gap-1 px-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Adjustments <ChevronDown className={`w-3 h-3 transition-transform ${showSliders ? 'rotate-180' : ''}`} />
              </button>
              {showSliders && (
                <AdjustmentSliders
                  brightness={brightness} contrast={contrast} sharpness={sharpness}
                  onBrightness={setBrightness} onContrast={setContrast} onSharpness={setSharpness}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {showExport && (
        <ExportDialog doc={doc} onClose={() => setShowExport(false)} />
      )}
      {showOCR && currentPage && (
        <OCRModal imageData={currentPage.processedImageData} onClose={() => setShowOCR(false)} />
      )}
    </div>
  );
}
