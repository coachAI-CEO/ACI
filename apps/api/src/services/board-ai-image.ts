export const BOARD_CHAT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const BOARD_CHAT_PDF_MAX_BYTES = 5 * 1024 * 1024;
export const BOARD_CHAT_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);
export const BOARD_CHAT_PDF_MIME = 'application/pdf';

export type BoardChatImage = {
  mimeType: string;
  data: string;
  fileName?: string;
};

export function isBoardChatPdf(mimeType: string | undefined | null): boolean {
  return String(mimeType || '').toLowerCase() === BOARD_CHAT_PDF_MIME;
}

export function parseBoardChatImage(raw: unknown): BoardChatImage | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const fileName = rec.fileName ? String(rec.fileName).slice(0, 180) : undefined;
  const mimeType = normalizeAttachmentMime(
    String(rec.mimeType || rec.mime || ''),
    fileName
  );
  const data = stripDataUrl(String(rec.data || rec.base64 || ''));
  if (!mimeType && !data) return null;
  const isPdf = isBoardChatPdf(mimeType);
  if (!isPdf && !BOARD_CHAT_IMAGE_MIMES.has(mimeType)) {
    throw new BoardChatImageError('Use a JPG, PNG, WebP, GIF, or PDF.');
  }
  if (!data || data.length < 32) {
    throw new BoardChatImageError(isPdf ? 'That PDF could not be read.' : 'That image could not be read.');
  }
  const approxBytes = Math.floor((data.length * 3) / 4);
  const maxBytes = isPdf ? BOARD_CHAT_PDF_MAX_BYTES : BOARD_CHAT_IMAGE_MAX_BYTES;
  if (approxBytes > maxBytes) {
    throw new BoardChatImageError(
      isPdf ? 'PDF too large (max 5MB).' : 'Image too large (max 4MB). Try a tighter crop.'
    );
  }
  return { mimeType, data, fileName };
}

export class BoardChatImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardChatImageError';
  }
}

function stripDataUrl(raw: string): string {
  const t = String(raw || '').trim();
  const comma = t.indexOf(',');
  if (t.startsWith('data:') && comma >= 0) return t.slice(comma + 1).replace(/\s/g, '');
  return t.replace(/\s/g, '');
}

function normalizeAttachmentMime(raw: string, fileName?: string): string {
  const t = raw.toLowerCase().trim();
  if (t === 'image/jpg') return 'image/jpeg';
  if (t === BOARD_CHAT_PDF_MIME || t === 'application/x-pdf') return BOARD_CHAT_PDF_MIME;
  if (BOARD_CHAT_IMAGE_MIMES.has(t) || t === BOARD_CHAT_PDF_MIME) return t;
  if (fileName && /\.pdf$/i.test(fileName)) return BOARD_CHAT_PDF_MIME;
  if (fileName && /\.jpe?g$/i.test(fileName)) return 'image/jpeg';
  if (fileName && /\.png$/i.test(fileName)) return 'image/png';
  if (fileName && /\.webp$/i.test(fileName)) return 'image/webp';
  if (fileName && /\.gif$/i.test(fileName)) return 'image/gif';
  return t;
}
