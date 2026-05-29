import type { FilterType } from '../types';

export function applyFilter(
  canvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  filter: FilterType,
  brightness: number,
  contrast: number,
  sharpness: number
): void {
  const ctx = canvas.getContext('2d')!;
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  switch (filter) {
    case 'magic':
      applyMagicColor(data, brightness, contrast);
      break;
    case 'docs':
      applyDocs(data, canvas.width, canvas.height, brightness);
      break;
    case 'clear':
      applyClear(data, brightness, contrast);
      break;
    case 'grayscale':
      applyGrayscale(data, brightness, contrast);
      break;
    default:
      applyAdjustments(data, brightness, contrast);
  }

  if (sharpness > 0) {
    ctx.putImageData(imageData, 0, 0);
    applySharpen(ctx, canvas.width, canvas.height, sharpness);
    return;
  }

  ctx.putImageData(imageData, 0, 0);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function applyAdjustments(data: Uint8ClampedArray, brightness: number, contrast: number): void {
  const bAdj = (brightness - 100) * 2.55;
  const cFactor = contrast / 100;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c];
      val = (val - 128) * cFactor + 128 + bAdj;
      data[i + c] = clamp(val);
    }
  }
}

function applyGrayscale(data: Uint8ClampedArray, brightness: number, contrast: number): void {
  const bAdj = (brightness - 100) * 2.55;
  const cFactor = contrast / 100;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let val = (gray - 128) * cFactor + 128 + bAdj;
    val = clamp(val);
    data[i] = data[i + 1] = data[i + 2] = val;
  }
}

function applyMagicColor(data: Uint8ClampedArray, brightness: number, contrast: number): void {
  const bAdj = ((brightness - 100) * 2.55) + 15;
  const cFactor = (contrast / 100) * 1.3;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c];
      val = (val - 128) * cFactor + 128 + bAdj;
      data[i + c] = clamp(val);
    }
    data[i] = clamp(data[i] * 1.05);
    data[i + 1] = clamp(data[i + 1] * 1.02);
  }
}

/** Fast 2-pass box blur using prefix sums. Returns a new smoothed Float32Array. */
function boxBlurGray(src: Float32Array, width: number, height: number, r: number): Float32Array {
  const temp = new Float32Array(src.length);
  const dst  = new Float32Array(src.length);
  const pfx  = new Float32Array(Math.max(width, height) + 1);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    pfx[0] = 0;
    for (let x = 0; x < width; x++) pfx[x + 1] = pfx[x] + src[row + x];
    for (let x = 0; x < width; x++) {
      const a = Math.max(0, x - r), b = Math.min(width, x + r + 1);
      temp[row + x] = (pfx[b] - pfx[a]) / (b - a);
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    pfx[0] = 0;
    for (let y = 0; y < height; y++) pfx[y + 1] = pfx[y] + temp[y * width + x];
    for (let y = 0; y < height; y++) {
      const a = Math.max(0, y - r), b = Math.min(height, y + r + 1);
      dst[y * width + x] = (pfx[b] - pfx[a]) / (b - a);
    }
  }

  return dst;
}

function applyDocs(data: Uint8ClampedArray, width: number, height: number, brightness: number): void {
  const n = width * height;

  // 1. Convert to grayscale
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  // 2. Pre-blur the gray (radius 3) to use as a SMOOTH local-mean reference.
  //    This is only used to build the integral image — the actual pixel values
  //    compared below are the ORIGINAL gray[], so text never thickens.
  const smooth = boxBlurGray(gray, width, height, 3);

  // 3. Build integral image from the SMOOTHED gray for O(1) local mean lookups
  const W1 = width + 1;
  const integral = new Float64Array(W1 * (height + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      integral[(y + 1) * W1 + (x + 1)] =
        smooth[y * width + x] +
        integral[y * W1 + (x + 1)] +
        integral[(y + 1) * W1 + x] -
        integral[y * W1 + x];
    }
  }

  // 4. Adaptive threshold:
  //    - Pixel value: ORIGINAL gray  → text stays its natural stroke width
  //    - Reference:   SMOOTHED local mean → photo gradients yield a stable mean
  //    - C = 22: pixels must be >22 levels below local mean to count as ink.
  //      Photo gradients vary slowly, so they stay < 22 below mean → white.
  //      Ink strokes on paper are 80–200 levels below local mean → black.
  const hw = Math.min(Math.max(Math.floor(Math.min(width, height) * 0.09), 15), 70);
  const C  = 22 - (brightness - 100) * 0.18;

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - hw);
    const y2 = Math.min(height - 1, y + hw);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - hw);
      const x2 = Math.min(width - 1, x + hw);
      const area = (y2 - y1 + 1) * (x2 - x1 + 1);
      const sum =
        integral[(y2 + 1) * W1 + (x2 + 1)] -
        integral[y1 * W1 + (x2 + 1)] -
        integral[(y2 + 1) * W1 + x1] +
        integral[y1 * W1 + x1];
      const localMean = sum / area;
      // KEY: compare ORIGINAL gray[i], not smooth[i] — preserves natural stroke width
      const val = gray[y * width + x] < localMean - C ? 0 : 255;
      const idx = (y * width + x) * 4;
      data[idx] = data[idx + 1] = data[idx + 2] = val;
    }
  }
}

function applyClear(data: Uint8ClampedArray, brightness: number, _contrast: number): void {
  const n = data.length / 4;

  // Sample pixels to find per-channel 95th percentile (the background "white")
  const step = Math.max(1, Math.floor(n / 4000));
  const rS: number[] = [], gS: number[] = [], bS: number[] = [];
  for (let i = 0; i < n; i += step) {
    rS.push(data[i * 4]);
    gS.push(data[i * 4 + 1]);
    bS.push(data[i * 4 + 2]);
  }
  rS.sort((a, b) => a - b); gS.sort((a, b) => a - b); bS.sort((a, b) => a - b);
  const p = Math.floor(rS.length * 0.95);
  const maxR = Math.max(rS[p] ?? 255, 32);
  const maxG = Math.max(gS[p] ?? 255, 32);
  const maxB = Math.max(bS[p] ?? 255, 32);

  // Apply per-channel normalization to neutralize color cast, then boost contrast
  const bAdj = (brightness - 100) * 2.55;
  const enhance = 1.25;

  for (let i = 0; i < n; i++) {
    let r = (data[i * 4] / maxR) * 255;
    let g = (data[i * 4 + 1] / maxG) * 255;
    let b = (data[i * 4 + 2] / maxB) * 255;

    // Mild contrast stretch around midpoint
    r = clamp((r - 128) * enhance + 128 + bAdj);
    g = clamp((g - 128) * enhance + 128 + bAdj);
    b = clamp((b - 128) * enhance + 128 + bAdj);

    // Push near-white (background) to pure white
    if (r > 218 && g > 218 && b > 218) { r = g = b = 255; }

    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b;
  }
}

function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  const k = amount / 100;
  const kernel = [-k, -k, -k, -k, 1 + 8 * k, -k, -k, -k, -k];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        data[(y * width + x) * 4 + c] = clamp(sum);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export function rotateImage(src: string, degrees: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const rad = (degrees * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      canvas.width = img.width * cos + img.height * sin;
      canvas.height = img.width * sin + img.height * cos;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.src = src;
  });
}

export function imageToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.src = dataUrl;
  });
}

export function detectDocumentEdges(imageData: ImageData): { x: number; y: number }[] | null {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  const edgeX = convolve(gray, width, height, [-1, 0, 1, -2, 0, 2, -1, 0, 1]);
  const edgeY = convolve(gray, width, height, [-1, -2, -1, 0, 0, 0, 1, 2, 1]);
  const edges = new Float32Array(width * height);
  let maxEdge = 0;
  for (let i = 0; i < edges.length; i++) {
    edges[i] = Math.sqrt(edgeX[i] ** 2 + edgeY[i] ** 2);
    if (edges[i] > maxEdge) maxEdge = edges[i];
  }

  const threshold = maxEdge * 0.15;
  const edgePts: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] > threshold) {
        edgePts.push({ x, y });
      }
    }
  }

  if (edgePts.length < 10) return null;

  const margin = 0.08;
  return [
    { x: width * margin, y: height * margin },
    { x: width * (1 - margin), y: height * margin },
    { x: width * (1 - margin), y: height * (1 - margin) },
    { x: width * margin, y: height * (1 - margin) },
  ];
}

function convolve(src: Float32Array, width: number, height: number, kernel: number[]): Float32Array {
  const dst = new Float32Array(src.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += src[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      dst[y * width + x] = sum;
    }
  }
  return dst;
}

export function perspectiveWarp(
  src: HTMLCanvasElement,
  corners: { x: number; y: number }[]
): HTMLCanvasElement {
  const [tl, tr, br, bl] = corners;
  const widthTop = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
  const widthBot = Math.sqrt((br.x - bl.x) ** 2 + (br.y - bl.y) ** 2);
  const heightLeft = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
  const heightRight = Math.sqrt((br.x - tr.x) ** 2 + (br.y - tr.y) ** 2);
  const outW = Math.max(widthTop, widthBot);
  const outH = Math.max(heightLeft, heightRight);

  const dst = document.createElement('canvas');
  dst.width = Math.round(outW);
  dst.height = Math.round(outH);
  const dstCtx = dst.getContext('2d')!;

  const srcPts = [tl, tr, br, bl];
  const dstPts = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];

  const matrix = getPerspectiveTransform(srcPts, dstPts);
  const invMatrix = invertMatrix(matrix);

  const srcCtx = src.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, src.width, src.height);
  const dstData = dstCtx.createImageData(dst.width, dst.height);

  for (let dy = 0; dy < dst.height; dy++) {
    for (let dx = 0; dx < dst.width; dx++) {
      const { x: sx, y: sy } = applyTransform(invMatrix, dx, dy);
      const sx0 = Math.floor(sx), sy0 = Math.floor(sy);
      if (sx0 >= 0 && sx0 < src.width - 1 && sy0 >= 0 && sy0 < src.height - 1) {
        const fx = sx - sx0, fy = sy - sy0;
        const dstIdx = (dy * dst.width + dx) * 4;
        for (let c = 0; c < 3; c++) {
          const tl = srcData.data[(sy0 * src.width + sx0) * 4 + c];
          const tr = srcData.data[(sy0 * src.width + sx0 + 1) * 4 + c];
          const bl = srcData.data[((sy0 + 1) * src.width + sx0) * 4 + c];
          const br = srcData.data[((sy0 + 1) * src.width + sx0 + 1) * 4 + c];
          dstData.data[dstIdx + c] = tl * (1 - fx) * (1 - fy) + tr * fx * (1 - fy) + bl * (1 - fx) * fy + br * fx * fy;
        }
        dstData.data[dstIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(dstData, 0, 0);
  return dst;
}

function getPerspectiveTransform(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[]
): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dx);
    b.push(dy);
  }
  const h = solveLinear(A, b);
  return [...h, 1];
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n] / M[i][i];
    for (let j = i - 1; j >= 0; j--) M[j][n] -= M[j][i] * x[i];
  }
  return x;
}

function invertMatrix(m: number[]): number[] {
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = m;
  const det = h0 * (h4 * h8 - h5 * h7) - h1 * (h3 * h8 - h5 * h6) + h2 * (h3 * h7 - h4 * h6);
  return [
    (h4 * h8 - h5 * h7) / det,
    (h2 * h7 - h1 * h8) / det,
    (h1 * h5 - h2 * h4) / det,
    (h5 * h6 - h3 * h8) / det,
    (h0 * h8 - h2 * h6) / det,
    (h2 * h3 - h0 * h5) / det,
    (h3 * h7 - h4 * h6) / det,
    (h1 * h6 - h0 * h7) / det,
    (h0 * h4 - h1 * h3) / det,
  ];
}

function applyTransform(m: number[], x: number, y: number): { x: number; y: number } {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}
