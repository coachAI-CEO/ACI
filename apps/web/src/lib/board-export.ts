import { GifWriter } from "@/lib/gif-encoder";

const DEFAULT_SCALE = 2;
const CAPTION_BAND = 56;

function waitPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 40);
      });
    });
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function slugForExport(title: string, fallback: string) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const vb = clone.viewBox?.baseVal;
  const w = vb && vb.width ? vb.width : svg.clientWidth || 900;
  const h = vb && vb.height ? vb.height : svg.clientHeight || 560;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  return new XMLSerializer().serializeToString(clone);
}

function loadSvgImage(svgText: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterize board SVG"));
    };
    img.src = url;
  });
}

function drawCaption(ctx: CanvasRenderingContext2D, caption: string, y: number, width: number) {
  ctx.fillStyle = "#07111f";
  ctx.fillRect(0, y, width, CAPTION_BAND);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 15px ui-sans-serif, system-ui, sans-serif";
  const text = caption.trim().slice(0, 180);
  const pad = 18;
  const maxW = width - pad * 2;
  if (ctx.measureText(text).width <= maxW) {
    ctx.fillText(text, pad, y + 34);
    return;
  }
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
  lines.slice(0, 2).forEach((ln, i) => {
    ctx.fillText(ln, pad, y + 24 + i * 18);
  });
}

export async function rasterizeSvgElement(
  svg: SVGSVGElement,
  opts?: { scale?: number; caption?: string }
): Promise<{
  canvas: HTMLCanvasElement;
  blob: Blob;
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const scale = opts?.scale ?? DEFAULT_SCALE;
  const img = await loadSvgImage(serializeSvg(svg));
  const pitchW = Math.max(1, Math.round(img.naturalWidth * scale));
  const pitchH = Math.max(1, Math.round(img.naturalHeight * scale));
  const caption = opts?.caption?.trim();
  const extra = caption ? CAPTION_BAND : 0;
  const canvas = document.createElement("canvas");
  canvas.width = pitchW;
  canvas.height = pitchH + extra;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.fillStyle = "#06261c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, pitchW, pitchH);
  if (caption) drawCaption(ctx, caption, pitchH, pitchW);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png");
  });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    canvas,
    blob,
    data: imageData.data,
    width: canvas.width,
    height: canvas.height,
  };
}

export async function exportSvgPng(
  svg: SVGSVGElement,
  filename: string,
  opts?: { caption?: string }
) {
  const { blob } = await rasterizeSvgElement(svg, { caption: opts?.caption });
  downloadBlob(blob, filename);
}

export async function exportFramesGif(args: {
  svg: SVGSVGElement;
  frames: Array<{ delayMs: number; caption?: string; apply: () => void }>;
  filename: string;
  onProgress?: (label: string) => void;
}) {
  const { svg, frames, filename, onProgress } = args;
  if (!frames.length) throw new Error("No slides to export");

  let writer: GifWriter | null = null;
  for (let i = 0; i < frames.length; i++) {
    onProgress?.(`Exporting GIF… ${i + 1}/${frames.length}`);
    frames[i].apply();
    await waitPaint();
    const raster = await rasterizeSvgElement(svg, { caption: frames[i].caption, scale: 1.25 });
    if (!writer) writer = new GifWriter(raster.width, raster.height);
    writer.add({ data: raster.data, delayMs: frames[i].delayMs });
  }
  if (!writer) throw new Error("GIF encode failed");
  downloadBlob(writer.finish(), filename);
}
