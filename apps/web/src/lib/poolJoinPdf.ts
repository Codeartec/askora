import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export type PoolJoinPdfParams = {
  title: string;
  description?: string | null;
  poolCode: string;
  shareUrl: string;
  /** Public path under the web root, e.g. `/askora_logo.png` */
  logoPath?: string;
};

async function fetchFileAsDataUrl(path: string): Promise<string | null> {
  const base = globalThis.window?.location?.origin;
  if (!base) return null;
  const url = path.startsWith('http') ? path : new URL(path, base).href;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function nextYIfNeeded(doc: jsPDF, y: number, neededMm: number, margin: number, pageH: number): number {
  if (y + neededMm > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

/** One-page handout: logo, title, description, QR, pool code, join URL. */
export async function downloadPoolJoinSheetPdf(params: PoolJoinPdfParams): Promise<void> {
  const { title, description, poolCode, shareUrl, logoPath = '/askora_logo.png' } = params;

  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(shareUrl, { width: 512, margin: 1, errorCorrectionLevel: 'M' }),
    fetchFileAsDataUrl(logoPath),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = margin;

  if (logoDataUrl) {
    try {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error('logo'));
        img.src = logoDataUrl;
      });
      const maxW = 72;
      const ratio = dims.h / dims.w;
      const w = maxW;
      const h = maxW * ratio;
      const logoX = (pageW - w) / 2;
      doc.addImage(logoDataUrl, 'PNG', logoX, y, w, h);
      y += h + 8;
    } catch {
      // continue without logo
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(title, pageW - 2 * margin);
  y = nextYIfNeeded(doc, y, titleLines.length * 7 + 4, margin, pageH);
  doc.text(titleLines, pageW / 2, y, { align: 'center' });
  y += titleLines.length * 7 + 6;

  const desc = (description ?? '').trim();
  if (desc) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(desc, pageW - 2 * margin);
    const descHeight = descLines.length * 5;
    y = nextYIfNeeded(doc, y, descHeight + 6, margin, pageH);
    doc.text(descLines, pageW / 2, y, { align: 'center' });
    y += descHeight + 8;
  }

  const qrMm = 55;
  y = nextYIfNeeded(doc, y, qrMm + 14, margin, pageH);
  const qrX = (pageW - qrMm) / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, y, qrMm, qrMm);
  y += qrMm + 10;

  doc.setFont('courier', 'bold');
  doc.setFontSize(18);
  doc.text(poolCode.toUpperCase(), pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const urlLines = doc.splitTextToSize(shareUrl, pageW - 2 * margin);
  y = nextYIfNeeded(doc, y, urlLines.length * 4 + 4, margin, pageH);
  doc.text(urlLines, pageW / 2, y, { align: 'center' });

  const safeCode = poolCode.replace(/[^\w-]/g, '_');
  doc.save(`askora-pool-${safeCode}.pdf`);
}
