# Clear Scanner

A fully functional, client-side document scanner web app — an exact clone of the Clear Scanner mobile app. Processes everything in the browser for maximum privacy and speed.

## Run & Operate

- `pnpm --filter @workspace/clear-scanner run dev` — run the scanner app (PORT env var required)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Shadcn/ui, Lucide-React
- Image Processing: Custom perspective warp + Canny edge detection (pure JS)
- OCR: Tesseract.js (Web Worker based)
- PDF Export: jsPDF + html2canvas
- Storage: IndexedDB via localforage (all data stays in browser)
- Drag & Drop: @dnd-kit/core + @dnd-kit/sortable

## Where things live

- `artifacts/clear-scanner/src/pages/` — Dashboard, CameraCapture, CropEditor, DocumentEditor
- `artifacts/clear-scanner/src/components/` — FilterStrip, AdjustmentSliders, DocumentCard, ExportDialog, OCRModal
- `artifacts/clear-scanner/src/hooks/` — useCamera, useTesseract
- `artifacts/clear-scanner/src/utils/` — imageProcessing (filters, perspective warp), exportUtils (PDF/image)
- `artifacts/clear-scanner/src/lib/db.ts` — IndexedDB via localforage
- `artifacts/clear-scanner/src/types/index.ts` — TypeScript types

## Architecture decisions

- All processing is 100% client-side — no server needed, maximum privacy
- Perspective warp implemented in pure JS (no OpenCV.js dependency) for faster load
- Tesseract.js loaded on-demand when user opens OCR panel, not at startup
- IndexedDB via localforage persists documents across sessions
- `Document` type aliased as `ScanDocument` to avoid collision with DOM's `Document` global

## Product

- **Dashboard**: Grid/list view of scanned docs, search, folder management, multi-select, merge docs
- **Camera**: Live camera with auto-document detection overlay, torch toggle, camera flip
- **Crop Editor**: 4-corner perspective warp with magnifying loupe for precision
- **Filters**: Original, Magic Color, Docs (B&W high contrast), Clear, Grayscale
- **Adjustments**: Brightness, Contrast, Sharpness sliders
- **Multi-page editor**: Drag-and-drop reorder, rotate 90°, delete pages, add pages
- **OCR**: Tesseract.js text extraction with editable output, copy & .txt download
- **Export**: PDF (Low/Medium/Highest quality, A4/Letter/Legal) or JPEG/PNG

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `Document` type from types/ must be imported as `ScanDocument` to avoid TS conflicts with DOM Document
- `Folder` icon from lucide-react must be aliased as `FolderIcon` to avoid type conflict with Folder from types/
- Tesseract.js requires CORS-friendly worker URLs — the npm package handles this automatically
- Camera access requires HTTPS or localhost

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
