export interface ScannedPage {
  id: string;
  originalImageData: string;
  processedImageData: string;
  filter: FilterType;
  brightness: number;
  contrast: number;
  sharpness: number;
  rotation: number;
  createdAt: number;
}

export interface Document {
  id: string;
  title: string;
  folderId: string | null;
  pages: ScannedPage[];
  createdAt: number;
  updatedAt: number;
  thumbnail: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export type FilterType = 'original' | 'magic' | 'docs' | 'clear' | 'grayscale';

export interface Corner {
  x: number;
  y: number;
}

export interface CropPoints {
  topLeft: Corner;
  topRight: Corner;
  bottomRight: Corner;
  bottomLeft: Corner;
}

export interface ExportOptions {
  format: 'pdf' | 'jpeg' | 'png';
  quality: 'low' | 'medium' | 'highest';
  pageSize: 'a4' | 'letter' | 'legal';
}
