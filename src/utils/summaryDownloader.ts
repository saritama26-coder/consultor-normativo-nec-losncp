// jspdf se carga bajo demanda (import dinámico) para reducir el bundle inicial.
import { CitationGroup } from '../types/normative';

export interface SummaryExportData {
  question: string;
  keyPoints: string[];
  directAnswer?: string;
  confidenceLabel?: string;
  documentNames?: string[];
  citations?: CitationGroup[];
  timestamp?: string;
  projectName?: string;
  contractorName?: string;
  inspectorName?: string;
  bookEntryNumber?: string;
}

/**
 * Normaliza caracteres especiales para la fuente estándar Helvetica de jsPDF
 */
export function cleanTextForPdf(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\t\r]/g, ' ')
    .replace(/•/g, '*');
}

/**
 * Genera un slug seguro a partir de la pregunta
 */
function createSafeSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 30)
    .replace(/^_|_$/g, '') || 'conclusiones';
}

/**
 * Formatea la fecha y hora legible para Ecuador
 */
function formatReadableDate(isoString?: string): string {
  try {
    const d = isoString ? new Date(isoString) : new Date();
    return d.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date().toLocaleString('es-EC');
  }
}

/**
 * Dispara la descarga de un archivo Blob en el cliente
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
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
 * Descarga las conclusiones técnicas y resumen en formato de Texto Plano (.txt)
 * Estructurado específicamente para copiar o anexar en informes de obra,
 * bitácoras digitales, correos técnicos y memorandos a fiscalización.
 */
export function downloadSummaryTXT(data: SummaryExportData): void {
  const formattedDate = formatReadableDate(data.timestamp);
  const projectName = data.projectName?.trim() || '[ NO ESPECIFICADO - COMPLETAR EN EXPEDIENTE DE OBRA ]';
  const contractor = data.contractorName?.trim() || '__________________________________________________';
  const inspector = data.inspectorName?.trim() || '__________________________________________________';
  const bookEntry = data.bookEntryNumber?.trim() || '_______';

  const docNames = data.documentNames && data.documentNames.length > 0
    ? data.documentNames.join(', ')
    : 'Normativa Técnica y de Contratación Pública de Ecuador (NEC / LOSNCP)';

  let content = '';
  content += '================================================================================\r\n';
  content += '    FICHA TÉCNICA DE CONCLUSIONES Y RESUMEN NORMATIVO PARA INFORME DE OBRA\r\n';
  content += '            CONSULTOR NORMATIVO ECUADOR (NEC - LOSNCP - SERCOP)\r\n';
  content += '================================================================================\r\n\r\n';

  content += `DATOS GENERALES DE LA CONSULTA Y OBRA:\r\n`;
  content += `--------------------------------------------------------------------------------\r\n`;
  content += `PROYECTO / OBRA:       ${projectName}\r\n`;
  content += `FECHA DE CONSULTA:     ${formattedDate}\r\n`;
  content += `ESTADO DE RESPALDO:    ${data.confidenceLabel || 'Respaldo Normativo Verificado'}\r\n`;
  content += `NORMATIVAS APLICADAS:  ${docNames}\r\n`;
  content += `CONSULTA TÉCNICA:      ${data.question}\r\n\r\n`;

  content += `================================================================================\r\n`;
  content += `1. SÍNTESIS DE CONCLUSIONES TÉCNICAS Y PUNTOS CLAVE PARA OBRA\r\n`;
  content += `================================================================================\r\n`;
  if (data.keyPoints && data.keyPoints.length > 0) {
    data.keyPoints.forEach((point, idx) => {
      content += `[${idx + 1}] ${point}\r\n\r\n`;
    });
  } else {
    content += `(No se generaron puntos clave específicos para esta consulta).\r\n\r\n`;
  }

  if (data.directAnswer) {
    content += `--------------------------------------------------------------------------------\r\n`;
    content += `2. CRITERIO TÉCNICO DIRECTO Y FUNDAMENTO EXPLICATIVO\r\n`;
    content += `--------------------------------------------------------------------------------\r\n`;
    content += `${data.directAnswer.trim()}\r\n\r\n`;
  }

  if (data.citations && data.citations.length > 0) {
    content += `--------------------------------------------------------------------------------\r\n`;
    content += `3. DISPOSICIONES LEGALES Y CITAS TEXTUALES DE RESPALDO\r\n`;
    content += `--------------------------------------------------------------------------------\r\n`;
    data.citations.forEach((group) => {
      content += `>> CUERPO NORMATIVO: ${group.documentName} [${group.category}]\r\n`;
      group.citations.forEach((c) => {
        content += `   * Art./Numeral: ${c.articleOrNumeral} (Pág. ${c.pageNumber || 's/n'})\r\n`;
        content += `     Texto literal: "${c.literalQuote.replace(/[\r\n]+/g, ' ')}"\r\n\r\n`;
      });
    });
  }

  content += `================================================================================\r\n`;
  content += `4. CONSTANCIA DE REGISTRO EN LIBRO DE OBRA / FISCALIZACIÓN TÉCNICA\r\n`;
  content += `================================================================================\r\n`;
  content += `ASIENTO / FOLIO N° DE LIBRO DE OBRA: ${bookEntry}\r\n`;
  content += `FECHA DE REGISTRO EN OBRA: ________ de ___________________ de 20____\r\n\r\n`;
  content += `RESIDENTE DE OBRA / CONSTRUCTOR:          FISCALIZADOR / SUPERVISOR DE OBRA:\r\n`;
  content += `Nombre: ${contractor}\r\n`;
  content += `Firma:  ___________________________        Firma:  ___________________________\r\n`;
  content += `C.I.:   ___________________________        C.I.:   ___________________________\r\n`;
  content += `Reg. Prof.: _______________________        Reg. Prof.: _______________________\r\n\r\n`;

  content += `--------------------------------------------------------------------------------\r\n`;
  content += `NOTA TÉCNICA: Documento generado como soporte profesional basado en la normativa\r\n`;
  content += `vigente del Ecuador. Su inclusión en bitácoras o informes técnicos debe ser\r\n`;
  content += `validada por los profesionales responsables de la ejecución y fiscalización.\r\n`;
  content += `================================================================================\r\n`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const filename = `Conclusiones_Obra_${createSafeSlug(data.question)}_${Date.now()}.txt`;
  triggerBlobDownload(blob, filename);
}

/**
 * Genera y descarga un informe ejecutivo / ficha técnica en PDF
 * con diseño formal para informes de obra, fiscalización y carpetas técnicas.
 */
export async function downloadSummaryPDF(data: SummaryExportData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;
  const topMargin = 20;
  const bottomMargin = 20;

  let currentY = topMargin;

  // Helper para controlar saltos de página
  const checkPageOverflow = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topMargin;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('FICHA TECNICA DE CONCLUSIONES NORMATIVAS - INFORME DE OBRA', marginX, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Consultor Normativo Ecuador (NEC / LOSNCP)', pageWidth - marginX, 12, { align: 'right' });

    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  };

  // 1. BANNER PRINCIPAL DE ENCABEZADO
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(marginX, currentY, contentWidth, 24, 2, 2, 'F');

  // Acento dorado / ámbar en el borde izquierdo
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(marginX, currentY, 3, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('FICHA TECNICA DE CONCLUSIONES NORMATIVAS', marginX + 7, currentY + 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text('Sintesis Ejecutiva para Residencia de Obra, Fiscalizacion y Libro de Obra', marginX + 7, currentY + 14.5);

  // Badge derecho: USO OFICIAL EN OBRA
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(pageWidth - marginX - 52, currentY + 4, 46, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text('INFORME DE OBRA', pageWidth - marginX - 29, currentY + 8.5, { align: 'center' });

  // Fecha en header
  const formattedDate = formatReadableDate(data.timestamp);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Emision: ${cleanTextForPdf(formattedDate)}`, marginX + 7, currentY + 20);

  currentY += 28;

  // 2. CUADRO DE METADATOS Y CONTEXTO DE OBRA
  const projectName = cleanTextForPdf(data.projectName?.trim() || 'Proyecto / Obra no especificada (Completar en expediente)');
  const questionClean = cleanTextForPdf(data.question);
  const confidence = cleanTextForPdf(data.confidenceLabel || 'Respaldo normativo verificado con citas textuales');
  const docsClean = cleanTextForPdf(data.documentNames?.join(', ') || 'Normativa de Construccion y Contratacion Publica (NEC / LOSNCP)');

  const qLines = doc.splitTextToSize(questionClean, contentWidth - 36);
  const metaHeight = 32 + (qLines.length - 1) * 3.5;

  checkPageOverflow(metaHeight + 4);

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(marginX, currentY, contentWidth, metaHeight, 1.5, 1.5, 'FD');

  let metaY = currentY + 5.5;

  // Obra / Proyecto
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('OBRA / PROYECTO:', marginX + 4, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(doc.splitTextToSize(projectName, contentWidth - 36), marginX + 34, metaY);

  metaY += 5.5;

  // Consulta Planteada
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CONSULTA:', marginX + 4, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(qLines, marginX + 34, metaY);

  metaY += qLines.length * 3.8 + 2;

  // Respaldo Normativo
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('RESPALDO:', marginX + 4, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(confidence, marginX + 34, metaY);

  metaY += 5;

  // Normativas Aplicadas
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('NORMATIVA:', marginX + 4, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(doc.splitTextToSize(docsClean, contentWidth - 36), marginX + 34, metaY);

  currentY += metaHeight + 6;

  // 3. SECCIÓN PRINCIPAL: CONCLUSIONES TÉCNICAS Y PUNTOS CLAVE PARA OBRA
  checkPageOverflow(30);

  // Barra de título de la sección
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(marginX, currentY, contentWidth, 7, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('1. CONCLUSIONES TECNICAS Y PUNTOS CLAVE PARA APLICACION EN OBRA', marginX + 4, currentY + 4.8);

  currentY += 10;

  // Lista de puntos clave
  if (data.keyPoints && data.keyPoints.length > 0) {
    for (let i = 0; i < data.keyPoints.length; i++) {
      const rawPoint = data.keyPoints[i];
      const cleanPoint = cleanTextForPdf(rawPoint);
      const pointLines = doc.splitTextToSize(cleanPoint, contentWidth - 14);
      const cardHeight = Math.max(10, pointLines.length * 3.8 + 5);

      checkPageOverflow(cardHeight + 2);

      // Tarjeta contenedora de cada conclusión
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(254, 215, 170); // orange-200
      doc.roundedRect(marginX, currentY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

      // Círculo numerado
      doc.setFillColor(245, 158, 11); // amber-500
      doc.circle(marginX + 5, currentY + 5, 3.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`${i + 1}`, marginX + 5, currentY + 6.1, { align: 'center' });

      // Texto de la conclusión
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(pointLines, marginX + 11, currentY + 5);

      currentY += cardHeight + 2.5;
    }
  } else {
    const fallbackText = 'No se especificaron puntos clave sinteticos para esta consulta.';
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(fallbackText, marginX + 4, currentY + 4);
    currentY += 8;
  }

  currentY += 3;

  // 4. SECCIÓN 2: CRITERIO TÉCNICO DIRECTO Y EXPLICACIÓN
  if (data.directAnswer) {
    checkPageOverflow(26);

    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('2. CRITERIO TECNICO DIRECTO Y SUSTENTO NORMATIVO', marginX + 4, currentY + 4.5);

    currentY += 9;

    const cleanAnswer = cleanTextForPdf(data.directAnswer);
    const paragraphs = cleanAnswer.split('\n').filter((p) => p.trim().length > 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85); // slate-700

    for (const para of paragraphs) {
      const pLines = doc.splitTextToSize(para.trim(), contentWidth);
      const pHeight = pLines.length * 3.8;
      checkPageOverflow(pHeight + 3);

      doc.text(pLines, marginX, currentY);
      currentY += pHeight + 2.5;
    }

    currentY += 2;
  }

  // 5. SECCIÓN 3: CITAS Y ARTÍCULOS NORMATIVOS OFICIALES
  if (data.citations && data.citations.length > 0) {
    checkPageOverflow(24);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('3. ARTICULOS Y CITAS TEXTUALES DE RESPALDO OFICIAL', marginX + 4, currentY + 4.5);

    currentY += 9;

    for (const group of data.citations) {
      checkPageOverflow(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`>> ${cleanTextForPdf(group.documentName)} [${cleanTextForPdf(group.category)}]`, marginX, currentY);
      currentY += 4.5;

      for (const cit of group.citations) {
        const quoteClean = cleanTextForPdf(cit.literalQuote).replace(/[\r\n]+/g, ' ');
        const quoteLines = doc.splitTextToSize(`"${quoteClean}"`, contentWidth - 8);
        const citHeight = quoteLines.length * 3.4 + 5;

        checkPageOverflow(citHeight + 2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(3, 105, 161); // sky-700
        doc.text(`* ${cleanTextForPdf(cit.articleOrNumeral)} - Pag. ${cleanTextForPdf(cit.pageNumber || 's/n')}`, marginX + 3, currentY);
        currentY += 3.8;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(quoteLines, marginX + 5, currentY);
        currentY += quoteLines.length * 3.4 + 2;
      }
    }

    currentY += 3;
  }

  // 6. SECCIÓN 4: RECUADRO PARA LIBRO DE OBRA Y FIRMAS DE RESPONSABILIDAD TÉCNICA
  checkPageOverflow(44);

  doc.setFillColor(250, 250, 249); // stone-50
  doc.setDrawColor(214, 211, 209); // stone-300
  doc.roundedRect(marginX, currentY, contentWidth, 38, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(28, 25, 23); // stone-900
  doc.text('4. CONSTANCIA EN LIBRO DE OBRA Y FIRMAS DE RESPONSABILIDAD', marginX + 4, currentY + 5);

  const bookEntry = cleanTextForPdf(data.bookEntryNumber?.trim() || '_______');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(87, 83, 78);
  doc.text(`Asiento en Libro de Obra / Bitacora N°: ${bookEntry}     Fecha de Asiento: _____ / _____ / 202___`, marginX + 4, currentY + 10);

  // Columnas para firmas
  const colW = (contentWidth - 12) / 2;
  const col1X = marginX + 4;
  const col2X = marginX + 8 + colW;
  const signLineY = currentY + 26;

  // Firma Residente
  doc.setDrawColor(168, 162, 158);
  doc.line(col1X, signLineY, col1X + colW - 4, signLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(28, 25, 23);
  doc.text(cleanTextForPdf(data.contractorName?.trim() || 'RESIDENTE DE OBRA / CONSTRUCTOR'), col1X, signLineY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 113, 108);
  doc.text('C.I. / Reg. Profesional: ________________________', col1X, signLineY + 8);

  // Firma Fiscalizador
  doc.line(col2X, signLineY, col2X + colW - 4, signLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(28, 25, 23);
  doc.text(cleanTextForPdf(data.inspectorName?.trim() || 'FISCALIZADOR / SUPERVISOR DE OBRA'), col2X, signLineY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 113, 108);
  doc.text('C.I. / Reg. Profesional: ________________________', col2X, signLineY + 8);

  currentY += 44;

  // PIE DE PÁGINA EN TODAS LAS PÁGINAS
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Ficha de conclusiones normativas emitida por Consultor Normativo Ecuador. Verifique siempre los articulos en el Registro Oficial.',
      marginX,
      pageHeight - 8
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Pagina ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  const filename = `Conclusiones_Obra_${createSafeSlug(data.question)}_${Date.now()}.pdf`;
  doc.save(filename);
}
