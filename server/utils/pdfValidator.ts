import crypto from 'crypto';

export interface PDFValidationResult {
  isValid: boolean;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  error?: string;
  isScannedWarning?: boolean;
}

export function validatePDFBuffer(buffer: Buffer, originalFileName: string): PDFValidationResult {
  const fileSize = buffer.length;
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // 1. Minimum size check
  if (fileSize < 100) {
    return {
      isValid: false,
      fileHash,
      fileSize,
      mimeType: 'application/octet-stream',
      error: 'El archivo está vacío o es demasiado pequeño para ser un PDF válido.',
    };
  }

  // 2. Maximum size check (50MB)
  const MAX_SIZE = 50 * 1024 * 1024;
  if (fileSize > MAX_SIZE) {
    return {
      isValid: false,
      fileHash,
      fileSize,
      mimeType: 'application/pdf',
      error: `El archivo supera el límite máximo permitido de 50 MB (${(fileSize / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  // 3. Real signature verification (Magic Bytes: %PDF-)
  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    return {
      isValid: false,
      fileHash,
      fileSize,
      mimeType: 'application/octet-stream',
      error: 'Firma de archivo inválida. El archivo no es un documento PDF auténtico (falta cabecera %PDF-).',
    };
  }

  // 4. Check for EOF marker. A valid PDF normally ends with %%EOF; allowing a
  // short trailing range avoids rejecting PDFs with harmless trailing bytes.
  const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString('latin1');
  if (!tail.includes('%%EOF')) {
    return {
      isValid: false,
      fileHash,
      fileSize,
      mimeType: 'application/pdf',
      error: 'El archivo PDF parece estar dañado o incompleto: no contiene el marcador de cierre %%EOF.',
    };
  }

  return {
    isValid: true,
    fileHash,
    fileSize,
    mimeType: 'application/pdf',
  };
}
