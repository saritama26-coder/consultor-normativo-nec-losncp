import { ConsultationHistoryItem } from '../types/normative';

/**
 * Generates a clean timestamp string for filenames: YYYY-MM-DD_HHmm
 */
function getTimestampFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}${mins}`;
}

/**
 * Triggers a client-side download of a Blob file.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports all consultation history records to a formatted JSON file for backup.
 */
export function exportConsultationHistoryJSON(history: ConsultationHistoryItem[]): void {
  const exportData = {
    app: 'Consultor Normativo de la Construcción y Contratación Pública en Ecuador',
    exportedAt: new Date().toISOString(),
    totalRecords: history.length,
    consultations: history,
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const filename = `respaldo_consultas_${getTimestampFilename()}.json`;
  triggerDownload(blob, filename);
}

/**
 * Helper to escape CSV cell contents.
 * Wraps values in quotes and escapes internal quotes.
 */
function escapeCSVCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exporta todas las consultas almacenadas a un archivo CSV estructurado.
 * Incluye UTF-8 BOM (\uFEFF) para compatibilidad total con Microsoft Excel, Google Sheets y LibreOffice,
 * permitiendo al usuario mantener un registro externo y trazabilidad de sus revisiones normativas.
 */
export function exportConsultationHistoryCSV(
  history: ConsultationHistoryItem[],
  customFilename?: string
): void {
  const headers = [
    'ID Consulta',
    'Fecha ISO',
    'Fecha y Hora (Ecuador)',
    'Modo de Consulta',
    'Pregunta / Consulta Normativa',
    'Respuesta Técnica Directa',
    'Puntos Clave y Conclusiones (Síntesis)',
    'Normativas Consultadas',
    'Total Citas Normativas',
    'Detalle de Citas Literales (Artículos y Páginas)',
    'Aplicación en Obra Pública',
    'Contradicciones o Discrepancias',
    'Observaciones y Advertencias',
    'Tiene Estructura de Informe',
    'Nivel de Respaldo Normativo',
    'Etiquetas Personalizadas',
  ];

  const rows: string[] = [];
  rows.push(headers.map(escapeCSVCell).join(','));

  for (const item of history) {
    let formattedDate = item.timestamp;
    try {
      const d = new Date(item.timestamp);
      formattedDate = d.toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      // keep fallback
    }

    const docNames = item.documentNames?.join('; ') || '';
    
    // Aggregate citations
    let totalCitations = 0;
    const citationDetails: string[] = [];
    if (item.response?.citationsByDocument) {
      for (const group of item.response.citationsByDocument) {
        if (group.citations) {
          totalCitations += group.citations.length;
          for (const c of group.citations) {
            const doc = c.documentName || group.documentName || '';
            const art = c.articleOrNumeral || '';
            const page = c.pageNumber ? `Pág. ${c.pageNumber}` : 's/n';
            const quote = (c.literalQuote || '').replace(/[\r\n]+/g, ' ');
            citationDetails.push(`[${doc}] ${art} (${page}): "${quote}"`);
          }
        }
      }
    }

    const row = [
      escapeCSVCell(item.id),
      escapeCSVCell(item.timestamp),
      escapeCSVCell(formattedDate),
      escapeCSVCell(item.mode || 'general'),
      escapeCSVCell(item.question),
      escapeCSVCell(item.response?.directAnswer || ''),
      escapeCSVCell(item.response?.keyPointsSummary ? item.response.keyPointsSummary.join(' • ') : ''),
      escapeCSVCell(docNames),
      escapeCSVCell(totalCitations),
      escapeCSVCell(citationDetails.join(' | ')),
      escapeCSVCell(item.response?.caseApplication || ''),
      escapeCSVCell(item.response?.contradictions || ''),
      escapeCSVCell(item.response?.observations || ''),
      escapeCSVCell(item.response?.technicalReport ? 'SÍ' : 'NO'),
      escapeCSVCell(item.response?.confidenceLabel || item.response?.confidenceLevel || item.response?.status || 'Respaldo verificado'),
      escapeCSVCell(item.tags && item.tags.length > 0 ? item.tags.join('; ') : ''),
    ];

    rows.push(row.join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility with accents/ñ
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const filename = customFilename || `Registro_Revisiones_Normativas_${getTimestampFilename()}.csv`;
  triggerDownload(blob, filename);
}

export { exportConsultationHistoryPDF } from './pdfReportGenerator';
export type { HistoryPDFExportOptions } from './pdfReportGenerator';
