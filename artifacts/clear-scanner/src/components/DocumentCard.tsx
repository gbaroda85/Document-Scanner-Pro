import React from 'react';
import { MoreVertical, Trash2, FolderOpen, Edit2, FileText } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Document as ScanDocument } from '../types';

interface DocumentCardProps {
  doc: ScanDocument;
  view: 'grid' | 'list';
  selected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DocumentCard({ doc, view, selected, onSelect, onClick, onRename, onDelete, onMove }: DocumentCardProps) {
  if (view === 'list') {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
          selected ? 'border-teal-500 bg-teal-500/10' : 'border-border hover:bg-card/80'
        }`}
        onClick={onClick}
      >
        <div
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors cursor-pointer ${
            selected ? 'border-teal-500 bg-teal-500' : 'border-border'
          }`}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
        <div className="w-10 h-12 flex-shrink-0 rounded overflow-hidden bg-muted">
          {doc.thumbnail ? (
            <img src={doc.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{doc.title}</p>
          <p className="text-xs text-muted-foreground">{doc.pages.length} page{doc.pages.length !== 1 ? 's' : ''} · {formatDate(doc.updatedAt)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={e => e.stopPropagation()}>
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              <Edit2 className="w-4 h-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
              <FolderOpen className="w-4 h-4 mr-2" /> Move to Folder
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden cursor-pointer group transition-all border ${
        selected ? 'border-teal-500 shadow-lg shadow-teal-500/20' : 'border-border hover:border-teal-400/50 hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 transition-all ${
          selected ? 'border-teal-500 bg-teal-500' : 'border-white/70 bg-black/30 opacity-0 group-hover:opacity-100'
        }`}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      />
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded-lg bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              <MoreVertical className="w-3.5 h-3.5 text-white" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              <Edit2 className="w-4 h-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
              <FolderOpen className="w-4 h-4 mr-2" /> Move to Folder
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="aspect-[3/4] bg-muted">
        {doc.thumbnail ? (
          <img src={doc.thumbnail} alt={doc.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="p-2 bg-card">
        <p className="text-xs font-medium truncate">{doc.title}</p>
        <p className="text-xs text-muted-foreground">{doc.pages.length}p · {formatDate(doc.updatedAt)}</p>
      </div>
    </div>
  );
}
