import jsPDF from 'jspdf';
import type { ScannedPage, ExportOptions } from '../types';

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [210, 297],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

export async function exportAsPDF(
  pages: ScannedPage[],
  title: string,
  options: ExportOptions
): Promise<void> {
  const [pw, ph] = PAGE_SIZES[options.pageSize];
  const qualityMap = { low: 0.5, medium: 0.75, highest: 1.0 };
  const quality = qualityMap[options.quality];

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: options.pageSize });

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage();
    const img = new Image();
    await new Promise<void>((res) => {
      img.onload = () => res();
      img.src = pages[i].processedImageData;
    });

    const imgAspect = img.width / img.height;
    const pageAspect = pw / ph;
    let drawW = pw, drawH = ph;
    if (imgAspect > pageAspect) {
      drawH = pw / imgAspect;
    } else {
      drawW = ph * imgAspect;
    }
    const x = (pw - drawW) / 2;
    const y = (ph - drawH) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
  }

  pdf.save(`${sanitizeFilename(title)}.pdf`);
}

export async function exportAsImage(
  page: ScannedPage,
  format: 'jpeg' | 'png',
  title: string
): Promise<void> {
  const link = document.createElement('a');
  link.download = `${sanitizeFilename(title)}.${format}`;

  if (format === 'png') {
    const img = new Image();
    await new Promise<void>((res) => { img.onload = () => res(); img.src = page.processedImageData; });
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    link.href = canvas.toDataURL('image/png');
  } else {
    link.href = page.processedImageData;
  }

  link.click();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-. ]/gi, '_').slice(0, 80) || 'document';
}
