import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Camera, Upload, Search, Grid3X3, List, FolderPlus, Folder as FolderIcon,
  Trash2, X, Edit2, Check, FileText, ScanText, FolderOpen,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentCard } from '../components/DocumentCard';
import {
  getAllDocuments, getAllFolders, deleteDocument, saveFolder, deleteFolder, saveDocument, getDocument,
} from '../lib/db';
import type { Document as ScanDocument, Folder as FolderType } from '../types';

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [documents, setDocuments] = useState<ScanDocument[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveDocId, setMoveDocId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [docs, fols] = await Promise.all([getAllDocuments(), getAllFolders()]);
    setDocuments(docs);
    setFolders(fols);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredDocs = documents.filter(d => {
    const inFolder = activeFolderId ? d.folderId === activeFolderId : d.folderId === null;
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase());
    return inFolder && matchSearch;
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      (window as any).__cropState = { imageData: dataUrl };
      navigate('/crop');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDoc = async (id: string) => {
    await deleteDocument(id);
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
    load();
  };

  const handleDeleteSelected = async () => {
    await Promise.all([...selected].map(deleteDocument));
    setSelected(new Set());
    load();
  };

  const handleMerge = async () => {
    if (selected.size < 2) return;
    const ids = [...selected];
    const docs = await Promise.all(ids.map(id => getDocument(id)));
    const validDocs = docs.filter(Boolean) as Document[];
    const allPages = validDocs.flatMap(d => d.pages);
    const merged: Document = {
      id: crypto.randomUUID(),
      title: `Merged Document`,
      folderId: activeFolderId,
      pages: allPages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      thumbnail: allPages[0]?.processedImageData || '',
    };
    await saveDocument(merged);
    setSelected(new Set());
    load();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder: FolderType = { id: crypto.randomUUID(), name: newFolderName.trim(), createdAt: Date.now() };
    await saveFolder(folder);
    setNewFolderName('');
    setShowNewFolder(false);
    load();
  };

  const handleRename = async (id: string, isFolder: boolean) => {
    if (!renameValue.trim()) return;
    if (isFolder) {
      const folder = folders.find(f => f.id === id);
      if (folder) { await saveFolder({ ...folder, name: renameValue.trim() }); }
    } else {
      const doc = await getDocument(id);
      if (doc) { await saveDocument({ ...doc, title: renameValue.trim(), updatedAt: Date.now() }); }
    }
    setRenameId(null);
    setRenameValue('');
    load();
  };

  const handleMove = async (folderId: string | null) => {
    if (!moveDocId) return;
    const doc = await getDocument(moveDocId);
    if (doc) { await saveDocument({ ...doc, folderId, updatedAt: Date.now() }); }
    setShowMoveDialog(false);
    setMoveDocId(null);
    load();
  };

  const activeFolder = folders.find(f => f.id === activeFolderId);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="px-4 pt-safe-top bg-card/80 backdrop-blur-sm border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            {activeFolderId && (
              <button onClick={() => setActiveFolderId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors mr-1">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <ScanText className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-base">
              {activeFolder ? activeFolder.name : 'Clear Scanner'}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setView(v => v === 'grid' ? 'list' : 'grid')} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              {view === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </button>
            {!activeFolderId && (
              <button onClick={() => setShowNewFolder(true)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <FolderPlus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="relative pb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted/60 rounded-xl border border-transparent focus:border-teal-400 focus:outline-none transition-colors"
          />
        </div>
      </header>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 border-b border-teal-500/20 flex-shrink-0">
          <span className="text-sm text-teal-400 font-medium flex-1">{selected.size} selected</span>
          {selected.size >= 2 && (
            <Button size="sm" variant="ghost" onClick={handleMerge} className="text-teal-400 hover:text-teal-300 h-7 text-xs">
              Merge
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleDeleteSelected} className="text-destructive hover:text-destructive h-7 text-xs">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="h-7 text-xs">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!activeFolderId && folders.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">Folders</p>
            <div className="grid grid-cols-2 gap-2">
              {folders.map(folder => {
                const count = documents.filter(d => d.folderId === folder.id).length;
                return (
                  <div key={folder.id} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-teal-400/40 cursor-pointer group transition-all"
                    onClick={() => setActiveFolderId(folder.id)}>
                    <FolderIcon className="w-5 h-5 text-teal-400 flex-shrink-0" />
                    {renameId === folder.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(folder.id, true)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(folder.id, true); }}
                        className="flex-1 text-sm bg-transparent border-b border-teal-400 focus:outline-none"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{count}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 rounded hover:bg-muted" onClick={e => { e.stopPropagation(); setRenameId(folder.id); setRenameValue(folder.name); }}>
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button className="p-1 rounded hover:bg-muted text-destructive" onClick={e => { e.stopPropagation(); deleteFolder(folder.id).then(load); }}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-4 pt-4 pb-24">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-teal-400 opacity-60" />
              </div>
              <p className="font-medium text-foreground mb-1">
                {search ? 'No documents found' : 'No documents yet'}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? 'Try a different search term' : 'Scan or upload a document to get started'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">
                {activeFolderId ? 'Documents' : 'Recent'} · {filteredDocs.length}
              </p>
              {view === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredDocs.map(doc => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      view="grid"
                      selected={selected.has(doc.id)}
                      onSelect={() => setSelected(prev => {
                        const s = new Set(prev);
                        s.has(doc.id) ? s.delete(doc.id) : s.add(doc.id);
                        return s;
                      })}
                      onClick={() => navigate(`/editor/${doc.id}`)}
                      onRename={() => { setRenameId(doc.id); setRenameValue(doc.title); }}
                      onDelete={() => handleDeleteDoc(doc.id)}
                      onMove={() => { setMoveDocId(doc.id); setShowMoveDialog(true); }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDocs.map(doc => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      view="list"
                      selected={selected.has(doc.id)}
                      onSelect={() => setSelected(prev => {
                        const s = new Set(prev);
                        s.has(doc.id) ? s.delete(doc.id) : s.add(doc.id);
                        return s;
                      })}
                      onClick={() => navigate(`/editor/${doc.id}`)}
                      onRename={() => { setRenameId(doc.id); setRenameValue(doc.title); }}
                      onDelete={() => handleDeleteDoc(doc.id)}
                      onMove={() => { setMoveDocId(doc.id); setShowMoveDialog(true); }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {renameId && !folders.find(f => f.id === renameId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRenameId(null)}>
          <div className="bg-card rounded-2xl w-80 border border-border shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Rename Document</h3>
            <Input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(renameId, false); }}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRenameId(null)}>Cancel</Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => handleRename(renameId, false)}>
                <Check className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {showMoveDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowMoveDialog(false)}>
          <div className="bg-card rounded-t-2xl w-full max-w-sm border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Move to Folder</h3>
            </div>
            <div className="py-2">
              <button onClick={() => handleMove(null)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted transition-colors text-sm">
                <FolderOpen className="w-4 h-4 text-muted-foreground" /> No folder (root)
              </button>
              {folders.map(folder => (
                <button key={folder.id} onClick={() => handleMove(folder.id)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted transition-colors text-sm">
                  <FolderIcon className="w-4 h-4 text-teal-400" /> {folder.name}
                </button>
              ))}
            </div>
            <div className="px-5 pb-6">
              <Button variant="outline" className="w-full" onClick={() => setShowMoveDialog(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewFolder(false)}>
          <div className="bg-card rounded-2xl w-80 border border-border shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">New Folder</h3>
            <Input
              autoFocus
              placeholder="Folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewFolder(false)}>Cancel</Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" onClick={handleCreateFolder}>Create</Button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-4 flex flex-col gap-3 z-30">
        <label className="w-12 h-12 rounded-full bg-card border border-border shadow-lg flex items-center justify-center cursor-pointer hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Upload className="w-5 h-5" />
        </label>
        <button
          onClick={() => navigate('/camera')}
          className="w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/30 flex items-center justify-center text-white transition-all active:scale-95"
        >
          <Camera className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
