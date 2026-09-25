import { PDFPageContent } from '../types/normative';

// pdfjs-dist se carga bajo demanda (import dinámico) para reducir el bundle inicial.
async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  // Configure the worker source using unpkg CDN matching installed version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  return pdfjsLib;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return window.btoa(binary);
}

export interface ExtractedPDFResult {
  pageCount: number;
  pages: PDFPageContent[];
  isScanned: boolean;
  base64: string;
}

export async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: number, total: number) => void
): Promise<ExtractedPDFResult> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  const pdfjsLib = await loadPdfjs();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const pages: PDFPageContent[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageItems = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .filter(Boolean);
      
      const pageText = pageItems.join(' ').replace(/\s+/g, ' ').trim();
      totalChars += pageText.length;

      pages.push({
        pageNumber: pageNum,
        text: pageText,
      });

      if (onProgress) {
        onProgress(pageNum, numPages);
      }
    } catch (err) {
      console.warn(`Error al leer la página ${pageNum}:`, err);
      pages.push({
        pageNumber: pageNum,
        text: '',
      });
    }
  }

  // Scanned detection: If average characters per page is very low (< 30) or total text < 50 chars
  const averageCharsPerPage = totalChars / Math.max(1, numPages);
  const isScanned = averageCharsPerPage < 30 || totalChars < 50;

  return {
    pageCount: numPages,
    pages,
    isScanned,
    base64,
  };
}
