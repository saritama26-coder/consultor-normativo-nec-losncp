// jspdf se carga bajo demanda (import dinámico) para reducir el bundle inicial.
import { ConsultationHistoryItem } from '../types/normative';

interface GeneratePDFOptions {
  fileName?: string;
}

/**
 * Normaliza caracteres tipográficos especiales para compatibilidad
 * perfecta con la fuente Helvetica estándar de jsPDF.
 */
function cleanTextForPdf(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019]/g, "'") // comillas simples curvadas
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"') // comillas dobles curvadas y angulares
    .replace(/[\u2013\u2014]/g, '-') // guiones largos y semilargos
    .replace(/\u2026/g, '...') // puntos suspensivos
    .replace(/[\u00A0]/g, ' ') // espacio de no separación
    .replace(/[\t\r]/g, ' ');
}

/**
 * Genera y descarga un reporte formal en formato PDF de una consulta técnico-normativa
 * utilizando la biblioteca jsPDF, manteniendo el formato riguroso de cita normativa
 * [Documento] - Art./Numeral - Pág. X del PDF y citas textuales entrecomilladas.
 */
export async function generateConsultationPDF(
  item: ConsultationHistoryItem,
  options?: GeneratePDFOptions
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;
  const topMargin = 22;
  const bottomMargin = 22;

  let currentY = topMargin;

  // Helper para verificar salto de página
  const checkPageOverflow = (heightNeeded: number) => {
    if (currentY + heightNeeded > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topMargin;
      drawPageHeader();
    }
  };

  // Helper para dibujar encabezado repetido en páginas subsiguientes
  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108); // stone-500
    doc.text('CONSULTOR NORMATIVO ECUADOR - REPORTE TECNICO-NORMATIVO', marginX, 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(168, 162, 158); // stone-400
    doc.text('NEC - LOSNCP - SERCOP - LOCGE - CRE', pageWidth - marginX, 12, { align: 'right' });

    doc.setDrawColor(231, 229, 228); // stone-200
    doc.setLineWidth(0.3);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  };

  // 1. ENCABEZADO PRINCIPAL (Primera página)
  // Fondo decorativo de cabecera
  doc.setFillColor(28, 25, 23); // stone-900 (negro institucional)
  doc.roundedRect(marginX, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('CONSULTOR NORMATIVO ECUADOR', marginX + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(214, 211, 209); // stone-300
  doc.text('Dictamen Tecnico y Citas Normativas Verificadas en Obra Publica', marginX + 6, currentY + 16);

  // Fecha legible
  const formattedDate = (() => {
    try {
      const d = new Date(item.timestamp);
      return d.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return item.timestamp || 'Fecha no registrada';
    }
  })();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(245, 245, 244);
  doc.text(`ID: #${item.id.slice(-6).toUpperCase()}`, pageWidth - marginX - 6, currentY + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(214, 211, 209);
  doc.text(formattedDate, pageWidth - marginX - 6, currentY + 16, { align: 'right' });

  currentY += 28;

  // 2. METADATOS Y PREGUNTA FORMULADA
  checkPageOverflow(30);
  
  // Caja de Pregunta
  doc.setFillColor(245, 245, 244); // stone-100
  doc.setDrawColor(214, 211, 209); // stone-300
  doc.setLineWidth(0.3);

  const cleanQuestion = cleanTextForPdf(item.question);
  const questionLines = doc.splitTextToSize(cleanQuestion, contentWidth - 12);
  const questionBoxHeight = Math.max(18, 12 + questionLines.length * 4.5);

  doc.roundedRect(marginX, currentY, contentWidth, questionBoxHeight, 2, 2, 'FD');

  // Línea de acento lateral izquierda
  doc.setFillColor(120, 113, 108); // stone-500
  doc.rect(marginX, currentY, 2.5, questionBoxHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(87, 83, 78); // stone-600
  doc.text('CONSULTA FORMULADA:', marginX + 6, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(28, 25, 23); // stone-900
  doc.text(questionLines, marginX + 6, currentY + 10.5);

  currentY += questionBoxHeight + 4;

  // Fila de metadatos (Estado de respaldo, Cuerpos consultados)
  checkPageOverflow(14);
  const confidenceLabel = cleanTextForPdf(item.response.confidenceLabel || 
    (item.response.status === 'FOUND' ? 'Respaldo Normativo Alto' :
     item.response.status === 'PARTIAL' ? 'Respaldo Parcial' :
     item.response.status === 'CONFLICT' ? 'Discrepancia / Contradiccion' : 'Sin Respaldo en Documentos'));

  const docsLabel = (item.documentNames && item.documentNames.length > 0)
    ? cleanTextForPdf(item.documentNames.join(', '))
    : 'Documentos normativos vigentes';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(87, 83, 78);
  doc.text('ESTADO DE RESPALDO:', marginX, currentY + 3);

  doc.setFont('helvetica', 'bold');
  if (item.response.status === 'FOUND') {
    doc.setTextColor(4, 120, 87); // emerald-700
  } else if (item.response.status === 'PARTIAL') {
    doc.setTextColor(180, 83, 9); // amber-700
  } else if (item.response.status === 'CONFLICT') {
    doc.setTextColor(194, 65, 12); // orange-700
  } else {
    doc.setTextColor(120, 113, 108); // stone-500
  }
  doc.text(confidenceLabel.toUpperCase(), marginX + 34, currentY + 3);

  // Documentos consultados
  const docsText = `Cuerpos normativos: ${docsLabel}`;
  const docsLines = doc.splitTextToSize(docsText, contentWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 113, 108);
  doc.text(docsLines, marginX, currentY + 7);

  currentY += 9 + (docsLines.length - 1) * 3.5 + 4;

  // 3. SECCIÓN: CONTRADICCIÓN / DISCREPANCIA (si existe)
  if (item.response.contradictions) {
    checkPageOverflow(26);
    const cleanContra = cleanTextForPdf(item.response.contradictions);
    const contraLines = doc.splitTextToSize(cleanContra, contentWidth - 14);
    const contraHeight = 12 + contraLines.length * 4.2;

    doc.setFillColor(255, 247, 237); // orange-50
    doc.setDrawColor(254, 215, 170); // orange-200
    doc.roundedRect(marginX, currentY, contentWidth, contraHeight, 2, 2, 'FD');

    // Acento lateral naranja
    doc.setFillColor(234, 88, 12); // orange-600
    doc.rect(marginX, currentY, 2.5, contraHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(154, 52, 18); // orange-800
    doc.text('DISCREPANCIA O CONTRADICCION NORMATIVA IDENTIFICADA', marginX + 6, currentY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(124, 45, 18); // orange-900
    doc.text(contraLines, marginX + 6, currentY + 10.5);

    currentY += contraHeight + 5;
  }

  // 4. SECCIÓN 1: RESPUESTA TÉCNICA DIRECTA
  checkPageOverflow(24);

  // Título de la sección
  doc.setDrawColor(28, 25, 23);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, marginX + 6, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(28, 25, 23); // stone-900
  doc.text('1. RESPUESTA TECNICA DIRECTA', marginX, currentY + 4);
  currentY += 8;

  // Contenido de la respuesta directa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(41, 37, 36); // stone-800

  const cleanDirectAnswer = cleanTextForPdf(item.response.directAnswer);
  const answerParagraphs = cleanDirectAnswer.split('\n').filter((p) => p.trim().length > 0);
  for (const para of answerParagraphs) {
    const lines = doc.splitTextToSize(para.trim(), contentWidth);
    const paraHeight = lines.length * 4.2;
    checkPageOverflow(paraHeight + 2);

    doc.text(lines, marginX, currentY);
    currentY += paraHeight + 2.5;
  }

  currentY += 3;

  // Resumen de Puntos Clave de la Normativa (Síntesis Ejecutiva)
  if (item.response.keyPointsSummary && item.response.keyPointsSummary.length > 0) {
    checkPageOverflow(26);

    const cleanPoints = item.response.keyPointsSummary.map((p) => cleanTextForPdf(p));
    let totalPointsHeight = 12;
    const splitPoints: string[][] = [];
    for (const pt of cleanPoints) {
      const ptLines = doc.splitTextToSize(`* ${pt}`, contentWidth - 12);
      splitPoints.push(ptLines);
      totalPointsHeight += ptLines.length * 3.8 + 2;
    }

    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11); // amber-500
    doc.roundedRect(marginX, currentY, contentWidth, totalPointsHeight, 1.5, 1.5, 'FD');

    // Barra lateral de acento ámbar
    doc.setFillColor(217, 119, 6); // amber-600
    doc.rect(marginX, currentY, 2.5, totalPointsHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 53, 15); // amber-900
    doc.text('RESUMEN DE PUNTOS CLAVE (SINTESIS EJECUTIVA DE LA NORMATIVA)', marginX + 6, currentY + 5.5);

    let ptY = currentY + 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(69, 26, 3);

    for (let i = 0; i < splitPoints.length; i++) {
      const ptLines = splitPoints[i];
      doc.text(ptLines, marginX + 6, ptY);
      ptY += ptLines.length * 3.8 + 2;
    }

    currentY += totalPointsHeight + 5;
  }

  // Sugerencia no verificada (si aplica)
  if (item.response.unverifiedSuggestion) {
    checkPageOverflow(20);
    const cleanUnverified = cleanTextForPdf(item.response.unverifiedSuggestion);
    const unverifiedLines = doc.splitTextToSize(
      `Nota orientativa: ${cleanUnverified}`,
      contentWidth - 10
    );
    const unvHeight = 8 + unverifiedLines.length * 3.8;

    doc.setFillColor(245, 245, 244);
    doc.setDrawColor(231, 229, 228);
    doc.roundedRect(marginX, currentY, contentWidth, unvHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text(unverifiedLines, marginX + 5, currentY + 5);

    currentY += unvHeight + 5;
  }

  // 5. SECCIÓN 2: FUNDAMENTO NORMATIVO (CITAS LITERALES EXACTAS)
  if (item.response.citationsByDocument && item.response.citationsByDocument.length > 0) {
    checkPageOverflow(24);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text('2. FUNDAMENTO NORMATIVO (CITAS LITERALES)', marginX, currentY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text('* Paginas correspondientes a la posicion correlativa en el archivo PDF oficial cargado', marginX, currentY + 8);
    
    currentY += 12;

    for (const group of item.response.citationsByDocument) {
      checkPageOverflow(16);

      // Cabecera del grupo documental
      doc.setFillColor(245, 245, 244); // stone-100
      doc.setDrawColor(231, 229, 228);
      doc.roundedRect(marginX, currentY, contentWidth, 7, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(28, 25, 23);
      doc.text(`[${cleanTextForPdf(group.documentName)}]`, marginX + 3, currentY + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(87, 83, 78);
      doc.text(`Categoria: ${cleanTextForPdf(group.category)}`, pageWidth - marginX - 3, currentY + 4.8, { align: 'right' });

      currentY += 9;

      // Iterar citas del documento manteniendo el formato normativo estricto
      for (const cite of group.citations) {
        const cleanDocName = cleanTextForPdf(cite.documentName || group.documentName);
        const cleanArt = cleanTextForPdf(cite.articleOrNumeral);
        const cleanPage = cleanTextForPdf(cite.pageNumber);
        const citeHeader = `[${cleanDocName}] - ${cleanArt} - ${cleanPage}`;
        const cleanQuote = cleanTextForPdf(cite.literalQuote.replace(/^["'«“]|["'»”]$/g, '').trim());

        // Calculamos dimensiones de la caja de cita
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        const quoteLines = doc.splitTextToSize(`"${cleanQuote}"`, contentWidth - 14);
        const cardHeight = 11 + quoteLines.length * 3.8 + 4;

        checkPageOverflow(cardHeight + 4);

        // Caja de la cita con fondo claro
        doc.setFillColor(250, 250, 249); // stone-50
        doc.setDrawColor(231, 229, 228); // stone-200
        doc.setLineWidth(0.25);
        doc.roundedRect(marginX, currentY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

        // Borde izquierdo distintivo verde esmeralda
        doc.setFillColor(4, 120, 87); // emerald-700
        doc.rect(marginX, currentY, 2, cardHeight, 'F');

        // Encabezado de la cita: [Documento] - Art. X - Pág. Y
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(28, 25, 23);
        doc.text(citeHeader, marginX + 5, currentY + 5);

        if (cite.verified) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(4, 120, 87);
          doc.text('(Cita verificada)', pageWidth - marginX - 4, currentY + 5, { align: 'right' });
        }

        // Etiqueta "Texto literal:"
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(120, 113, 108);
        doc.text('Texto literal:', marginX + 5, currentY + 9);

        // Bloque de texto entrecomillado
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(41, 37, 36);
        doc.text(quoteLines, marginX + 5, currentY + 13);

        currentY += cardHeight + 3.5;
      }

      currentY += 2;
    }
  }

  // 6. SECCIÓN 3: ESTRUCTURA DE INFORME TÉCNICO (si existe)
  if (item.response.technicalReport) {
    const report = item.response.technicalReport;
    checkPageOverflow(26);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text('3. ESTRUCTURA DE INFORME TECNICO DE FISCALIZACION', marginX, currentY + 4);
    currentY += 8;

    const sections = [
      { title: 'Antecedentes y Objeto:', text: cleanTextForPdf(`${report.antecedentes || ''} ${report.objeto || ''}`.trim()) },
      { title: 'Base Legal Aplicable:', text: cleanTextForPdf(report.baseLegal || '') },
      { title: 'Analisis Tecnico-Juridico:', text: cleanTextForPdf(report.analisis || '') },
      { title: 'Fundamento Tecnico en Obra:', text: cleanTextForPdf(report.fundamentoTecnico || '') },
      { title: 'Conclusiones y Recomendaciones:', text: cleanTextForPdf(`${report.conclusiones || ''} ${report.recomendaciones || ''}`.trim()) },
    ];

    for (const sec of sections) {
      if (!sec.text) continue;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const textLines = doc.splitTextToSize(sec.text, contentWidth);
      const blockHeight = 6 + textLines.length * 3.8;

      checkPageOverflow(blockHeight + 2);

      doc.setTextColor(28, 25, 23);
      doc.text(sec.title, marginX, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(68, 64, 60);
      doc.text(textLines, marginX, currentY + 4.2);

      currentY += blockHeight + 2;
    }

    currentY += 2;
  }

  // 7. SECCIÓN 4: APLICACIÓN AL CASO EN OBRA PÚBLICA (si existe)
  if (item.response.caseApplication) {
    checkPageOverflow(22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 25, 23);
    doc.text('4. APLICACION AL CASO EN OBRA PUBLICA', marginX, currentY + 4);
    currentY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(41, 37, 36);

    const cleanCase = cleanTextForPdf(item.response.caseApplication);
    const appLines = doc.splitTextToSize(cleanCase, contentWidth);
    const appHeight = appLines.length * 4.2;
    checkPageOverflow(appHeight + 4);

    doc.text(appLines, marginX, currentY);
    currentY += appHeight + 5;
  }

  // 8. SECCIÓN 5: OBSERVACIONES Y ADVERTENCIAS
  if (item.response.observations) {
    checkPageOverflow(20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(87, 83, 78);
    doc.text('OBSERVACIONES Y ADVERTENCIAS TECNICAS', marginX, currentY + 3);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);

    const cleanObs = cleanTextForPdf(item.response.observations);
    const obsLines = doc.splitTextToSize(cleanObs, contentWidth);
    const obsHeight = obsLines.length * 3.8;
    checkPageOverflow(obsHeight + 4);

    doc.text(obsLines, marginX, currentY);
    currentY += obsHeight + 4;
  }

  // 9. DIBUJAR PIE DE PÁGINA EN TODAS LAS PÁGINAS (Paginación exacta)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Si es página > 1, asegurar que tenga el encabezado superior
    if (p > 1) {
      drawPageHeader();
    }

    // Pie de página
    doc.setDrawColor(231, 229, 228); // stone-200
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 113, 108); // stone-500
    doc.text(
      'Documento de soporte normativo. Verifique la vigencia de los articulos en el Registro Oficial correspondiente.',
      marginX,
      pageHeight - 9
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      `Pagina ${p} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 9,
      { align: 'right' }
    );
  }

  // Sanitizar nombre de archivo
  const safeFileName = options?.fileName || (() => {
    const slug = item.question
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 35)
      .replace(/^_|_$/g, '');
    return `Reporte_Normativo_${slug || 'consulta'}_${Date.now()}.pdf`;
  })();

  // Descargar el archivo
  doc.save(safeFileName);
}

export interface HistoryPDFExportOptions {
  fileName?: string;
  filterQuery?: string;
  authorOrProject?: string;
}

/**
 * Exporta el historial completo (o filtrado) de consultas a un documento PDF formal,
 * estructurado y foliado, manteniendo las fechas exactas, el orden cronológico o temático,
 * las referencias normativas con su artículo y página en el PDF oficial, y las citas textuales.
 */
export async function exportConsultationHistoryPDF(
  history: ConsultationHistoryItem[],
  options?: HistoryPDFExportOptions
): Promise<void> {
  if (!history || history.length === 0) {
    throw new Error('No hay consultas para exportar en el historial.');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2; // 174mm
  const topMargin = 22;
  const bottomMargin = 20;

  let currentY = topMargin;

  // Helper para verificar salto de página
  const checkPageOverflow = (heightNeeded: number) => {
    if (currentY + heightNeeded > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topMargin;
      drawPageHeader();
    }
  };

  // Helper para encabezado repetido en páginas posteriores
  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('CONSULTOR NORMATIVO ECUADOR - EXPEDIENTE DE CONSULTAS Y REVISIONES', marginX, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('NEC / LOSNCP / SERCOP / LOCGE', pageWidth - marginX, 12, { align: 'right' });

    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  };

  // Helper para formatear fechas
  const formatEcuadorDate = (isoString?: string): string => {
    if (!isoString) return 'Fecha no registrada';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatFullDateTime = (isoString?: string): string => {
    if (!isoString) return 'Fecha no registrada';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // 1. PORTADA Y ENCABEZADO INSTITUCIONAL
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(marginX, currentY, contentWidth, 26, 2, 2, 'F');

  // Acento lateral dorado / ámbar
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(marginX, currentY, 3.5, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('HISTORIAL DE CONSULTAS Y REVISIONES NORMATIVAS', marginX + 7, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text(
    'Expediente Tecnico y Citas Normativas Verificadas de Construccion y Contratacion Publica',
    marginX + 7,
    currentY + 16
  );

  // Badge derecho de emisión
  const emissionDate = formatEcuadorDate(new Date().toISOString());
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text(`EXPEDIENTE: ${history.length} CONSULTAS`, pageWidth - marginX - 6, currentY + 9.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emision: ${cleanTextForPdf(emissionDate)}`, pageWidth - marginX - 6, currentY + 16, { align: 'right' });

  currentY += 31;

  // 2. CUADRO DE METADATOS GENERALES DEL EXPEDIENTE
  // Extraer normativas únicas consultadas en todo el historial
  const uniqueNormsSet = new Set<string>();
  history.forEach((h) => {
    if (h.documentNames) {
      h.documentNames.forEach((n) => uniqueNormsSet.add(n));
    }
    if (h.response?.citationsByDocument) {
      h.response.citationsByDocument.forEach((g) => uniqueNormsSet.add(g.documentName));
    }
  });
  const allNormsString = Array.from(uniqueNormsSet).join(', ') || 'Cuerpos Normativos Vigentes (NEC / LOSNCP)';

  const oldestDate = history.length > 0 ? formatEcuadorDate(history[history.length - 1].timestamp) : '';
  const newestDate = history.length > 0 ? formatEcuadorDate(history[0].timestamp) : '';
  const periodText = history.length > 1 ? `${oldestDate} a ${newestDate}` : newestDate;

  const filterText = options?.filterQuery?.trim()
    ? `Filtro de busqueda aplicado: "${cleanTextForPdf(options.filterQuery)}"`
    : 'Registro integro de consultas (Sin filtro)';

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);

  const cleanNorms = cleanTextForPdf(allNormsString);
  const normsLines = doc.splitTextToSize(cleanNorms, contentWidth - 42);
  const metaBoxHeight = 22 + normsLines.length * 3.6;

  checkPageOverflow(metaBoxHeight + 4);

  doc.roundedRect(marginX, currentY, contentWidth, metaBoxHeight, 1.5, 1.5, 'FD');

  let metaY = currentY + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('TOTAL CONSULTAS:', marginX + 4, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${history.length} registros estructurados con citas literales`, marginX + 38, metaY);

  metaY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('ALCANCE / FILTRO:', marginX + 4, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(filterText, marginX + 38, metaY);

  metaY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('PERIODO REGISTRADO:', marginX + 4, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(cleanTextForPdf(periodText), marginX + 38, metaY);

  metaY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('NORMATIVAS CITADAS:', marginX + 4, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(normsLines, marginX + 38, metaY);

  currentY += metaBoxHeight + 6;

  // 3. ÍNDICE / RESUMEN EJECUTIVO TABULAR
  checkPageOverflow(26);

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(marginX, currentY, contentWidth, 7, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('INDICE CRONOLOGICO DE CONSULTAS Y ESTADO DE RESPALDO', marginX + 4, currentY + 4.8);

  currentY += 9;

  // Cabecera de la tabla del índice
  // Columnas: # (8mm) | Fecha (24mm) | Consulta (74mm) | Normativa (42mm) | Respaldo (26mm) = 174mm
  const colW1 = 8;
  const colW2 = 24;
  const colW3 = 74;
  const colW4 = 42;
  const colW5 = 26;

  const colX1 = marginX;
  const colX2 = colX1 + colW1;
  const colX3 = colX2 + colW2;
  const colX4 = colX3 + colW3;
  const colX5 = colX4 + colW4;

  doc.setFillColor(226, 232, 240); // slate-200
  doc.rect(marginX, currentY, contentWidth, 5.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text('N°', colX1 + 2, currentY + 3.8);
  doc.text('FECHA', colX2 + 1, currentY + 3.8);
  doc.text('PREGUNTA FORMULADA', colX3 + 1, currentY + 3.8);
  doc.text('NORMATIVAS', colX4 + 1, currentY + 3.8);
  doc.text('RESPALDO', colX5 + 1, currentY + 3.8);

  currentY += 5.5;

  history.forEach((item, idx) => {
    checkPageOverflow(9);

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, 7, 'F');
    }

    const rowDate = formatEcuadorDate(item.timestamp);
    const cleanQ = cleanTextForPdf(item.question);
    const shortQ = cleanQ.length > 55 ? cleanQ.slice(0, 53) + '...' : cleanQ;

    const docsShort = (item.documentNames && item.documentNames.length > 0)
      ? cleanTextForPdf(item.documentNames.join(', '))
      : 'Normativa general';
    const shortDocs = docsShort.length > 30 ? docsShort.slice(0, 28) + '...' : docsShort;

    const confText = item.response?.confidenceLabel ||
      (item.response?.status === 'FOUND' ? 'Alto' :
       item.response?.status === 'PARTIAL' ? 'Parcial' :
       item.response?.status === 'CONFLICT' ? 'Discrepancia' : 'Revisión');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    doc.text(`${idx + 1}`, colX1 + 2, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(rowDate, colX2 + 1, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(shortQ, colX3 + 1, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(shortDocs, colX4 + 1, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    if (item.response?.status === 'FOUND') {
      doc.setTextColor(4, 120, 87); // emerald
    } else if (item.response?.status === 'CONFLICT') {
      doc.setTextColor(194, 65, 12); // orange
    } else {
      doc.setTextColor(180, 83, 9); // amber
    }
    doc.text(cleanTextForPdf(confText), colX5 + 1, currentY + 4.5);

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + 7, pageWidth - marginX, currentY + 7);

    currentY += 7;
  });

  currentY += 7;

  // 4. SECCIÓN DETALLADA DE CONSULTAS
  // Para cada consulta, renderizamos su ficha estructurada con pregunta, fecha, respuesta directa,
  // conclusiones clave y fundamento normativo con citas literales (artículo y página del PDF).
  history.forEach((item, index) => {
    // Si estamos muy cerca del final de página, abrimos página nueva para iniciar la consulta limpia
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = topMargin;
      drawPageHeader();
    } else {
      checkPageOverflow(30);
    }

    // Cabecera de la Consulta
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(marginX, currentY, contentWidth, 10, 1.5, 1.5, 'F');

    // Indicador numérico dorado
    doc.setFillColor(245, 158, 11); // amber-500
    doc.rect(marginX, currentY, 3, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`CONSULTA N° ${index + 1} de ${history.length}`, marginX + 6, currentY + 6.5);

    // ID y Fecha en header
    const formattedItemDate = formatFullDateTime(item.timestamp);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `ID: #${item.id.slice(-6).toUpperCase()}  |  ${cleanTextForPdf(formattedItemDate)}`,
      pageWidth - marginX - 5,
      currentY + 6.5,
      { align: 'right' }
    );

    currentY += 13;

    // Caja de la Pregunta
    const cleanQ = cleanTextForPdf(item.question);
    const questionLines = doc.splitTextToSize(cleanQ, contentWidth - 12);
    const qBoxHeight = Math.max(14, 10 + questionLines.length * 4.2);

    checkPageOverflow(qBoxHeight + 2);

    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, currentY, contentWidth, qBoxHeight, 1.5, 1.5, 'FD');

    // Acento lateral
    doc.setFillColor(100, 116, 139); // slate-500
    doc.rect(marginX, currentY, 2, qBoxHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('CONSULTA FORMULADA:', marginX + 5, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(questionLines, marginX + 5, currentY + 9.5);

    currentY += qBoxHeight + 3.5;

    // Sub-fila de metadatos: Estado de respaldo y normativas consultadas
    checkPageOverflow(12);
    const confidenceText = cleanTextForPdf(item.response?.confidenceLabel ||
      (item.response?.status === 'FOUND' ? 'Respaldo Normativo Alto' :
       item.response?.status === 'PARTIAL' ? 'Respaldo Parcial' :
       item.response?.status === 'CONFLICT' ? 'Discrepancia Normativa' : 'Respaldo en Documentos'));

    const docNamesList = (item.documentNames && item.documentNames.length > 0)
      ? cleanTextForPdf(item.documentNames.join(', '))
      : 'Documentos normativos oficiales cargados';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('RESPALDO:', marginX, currentY + 3);

    doc.setFont('helvetica', 'bold');
    if (item.response?.status === 'FOUND') {
      doc.setTextColor(4, 120, 87); // emerald
    } else if (item.response?.status === 'CONFLICT') {
      doc.setTextColor(194, 65, 12); // orange
    } else {
      doc.setTextColor(180, 83, 9); // amber
    }
    doc.text(confidenceText.toUpperCase(), marginX + 22, currentY + 3);

    const docsLineText = `Normativas: ${docNamesList}`;
    const docsLines = doc.splitTextToSize(docsLineText, contentWidth - 75);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(docsLines, marginX + 75, currentY + 3);

    currentY += 7 + (docsLines.length - 1) * 3 + 2;

    // Etiquetas asignadas al ítem (si existen)
    if (item.tags && item.tags.length > 0) {
      checkPageOverflow(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(146, 64, 14); // amber-800
      doc.text('ETIQUETAS:', marginX, currentY + 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(180, 83, 9); // amber-700
      const tagsText = cleanTextForPdf(item.tags.map((t) => `#${t}`).join('   '));
      doc.text(tagsText, marginX + 22, currentY + 2);
      currentY += 5;
    }

    // Contradicción o discrepancia (si existe en la respuesta)
    if (item.response?.contradictions) {
      const cleanContra = cleanTextForPdf(item.response.contradictions);
      const contraLines = doc.splitTextToSize(cleanContra, contentWidth - 12);
      const contraHeight = 10 + contraLines.length * 3.8;

      checkPageOverflow(contraHeight + 2);

      doc.setFillColor(255, 247, 237); // orange-50
      doc.setDrawColor(254, 215, 170); // orange-200
      doc.roundedRect(marginX, currentY, contentWidth, contraHeight, 1.5, 1.5, 'FD');

      doc.setFillColor(234, 88, 12); // orange-600
      doc.rect(marginX, currentY, 2, contraHeight, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(154, 52, 18);
      doc.text('DISCREPANCIA / CONTRADICCION IDENTIFICADA:', marginX + 5, currentY + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(124, 45, 18);
      doc.text(contraLines, marginX + 5, currentY + 9);

      currentY += contraHeight + 3.5;
    }

    // 4.1. RESPUESTA TÉCNICA DIRECTA
    checkPageOverflow(20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('1. CRITERIO Y RESPUESTA TECNICA DIRECTA', marginX, currentY + 4);
    currentY += 7;

    const cleanAnswer = cleanTextForPdf(item.response?.directAnswer || '');
    const answerParagraphs = cleanAnswer.split('\n').filter((p) => p.trim().length > 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85); // slate-700

    for (const para of answerParagraphs) {
      const pLines = doc.splitTextToSize(para.trim(), contentWidth);
      const pHeight = pLines.length * 3.8;
      checkPageOverflow(pHeight + 2);

      doc.text(pLines, marginX, currentY);
      currentY += pHeight + 2;
    }

    currentY += 2;

    // 4.2. PUNTOS CLAVE Y SÍNTESIS EJECUTIVA (si existen)
    if (item.response?.keyPointsSummary && item.response.keyPointsSummary.length > 0) {
      const cleanPoints = item.response.keyPointsSummary.map((p) => cleanTextForPdf(p));
      let pointsBoxHeight = 10;
      const splitPoints: string[][] = [];

      for (const pt of cleanPoints) {
        const ptLines = doc.splitTextToSize(`* ${pt}`, contentWidth - 12);
        splitPoints.push(ptLines);
        pointsBoxHeight += ptLines.length * 3.6 + 2;
      }

      checkPageOverflow(pointsBoxHeight + 2);

      doc.setFillColor(254, 243, 199); // amber-100
      doc.setDrawColor(245, 158, 11); // amber-500
      doc.roundedRect(marginX, currentY, contentWidth, pointsBoxHeight, 1.5, 1.5, 'FD');

      doc.setFillColor(217, 119, 6); // amber-600
      doc.rect(marginX, currentY, 2, pointsBoxHeight, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(146, 64, 14); // amber-800
      doc.text('SINTESIS DE PUNTOS CLAVE DE LA NORMATIVA:', marginX + 5, currentY + 5);

      let ptY = currentY + 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(69, 26, 3);

      for (const ptLines of splitPoints) {
        doc.text(ptLines, marginX + 5, ptY);
        ptY += ptLines.length * 3.6 + 2;
      }

      currentY += pointsBoxHeight + 4;
    }

    // 4.3. FUNDAMENTO NORMATIVO: CITAS LITERALES EXACTAS
    // Manteniendo rigurosamente: [Documento] - Art./Numeral - Pág. X del PDF oficial
    if (item.response?.citationsByDocument && item.response.citationsByDocument.length > 0) {
      checkPageOverflow(18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('2. FUNDAMENTO NORMATIVO Y CITAS LITERALES EXACTAS', marginX, currentY + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('* Citas textuales y paginacion exacta del archivo PDF oficial analizado', marginX, currentY + 7.5);

      currentY += 10.5;

      for (const group of item.response.citationsByDocument) {
        checkPageOverflow(12);

        // Cabecera del documento normativo
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, currentY, contentWidth, 6, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`[${cleanTextForPdf(group.documentName)}]`, marginX + 3, currentY + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Categoria: ${cleanTextForPdf(group.category)}`, pageWidth - marginX - 3, currentY + 4.2, { align: 'right' });

        currentY += 7.5;

        for (const cite of group.citations) {
          const cleanDoc = cleanTextForPdf(cite.documentName || group.documentName);
          const cleanArt = cleanTextForPdf(cite.articleOrNumeral);
          const cleanPage = cleanTextForPdf(cite.pageNumber ? `Pag. ${cite.pageNumber}` : 's/n');
          const cleanQuote = cleanTextForPdf(cite.literalQuote.replace(/^["'«“]|["'»”]$/g, '').trim());

          const citeTitle = `[${cleanDoc}] - ${cleanArt} - ${cleanPage} del PDF oficial`;
          const quoteLines = doc.splitTextToSize(`"${cleanQuote}"`, contentWidth - 12);
          const cardHeight = 10 + quoteLines.length * 3.5;

          checkPageOverflow(cardHeight + 2);

          doc.setFillColor(250, 250, 249); // stone-50
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.25);
          doc.roundedRect(marginX, currentY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

          // Borde verde esmeralda para citas verificadas
          doc.setFillColor(4, 120, 87); // emerald-700
          doc.rect(marginX, currentY, 2, cardHeight, 'F');

          // Título de la cita
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(15, 23, 42);
          doc.text(citeTitle, marginX + 4.5, currentY + 4.5);

          if (cite.verified) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(4, 120, 87);
            doc.text('(Cita verificada)', pageWidth - marginX - 3.5, currentY + 4.5, { align: 'right' });
          }

          // Cita literal
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.2);
          doc.setTextColor(51, 65, 85);
          doc.text(quoteLines, marginX + 4.5, currentY + 8.5);

          currentY += cardHeight + 2.5;
        }

        currentY += 1.5;
      }
    }

    // 4.4. APLICACIÓN AL CASO EN OBRA PÚBLICA (si existe)
    if (item.response?.caseApplication) {
      checkPageOverflow(18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('3. APLICACION EN OBRA PUBLICA Y FISCALIZACION', marginX, currentY + 4);
      currentY += 7;

      const cleanCase = cleanTextForPdf(item.response.caseApplication);
      const caseLines = doc.splitTextToSize(cleanCase, contentWidth);
      const caseHeight = caseLines.length * 3.8;
      checkPageOverflow(caseHeight + 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(caseLines, marginX, currentY);

      currentY += caseHeight + 3;
    }

    // Separador decorativo entre consultas
    checkPageOverflow(8);
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY + 2, pageWidth - marginX, currentY + 2);
    currentY += 7;
  });

  // 5. PIE DE PÁGINA Y ENCABEZADOS EN TODAS LAS PÁGINAS (Paginación exacta)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    if (p > 1) {
      drawPageHeader();
    }

    // Línea de pie de página
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Expediente de consultas y revisiones normativas. Consultor Normativo Ecuador (NEC / LOSNCP). Verifique la vigencia en el Registro Oficial.',
      marginX,
      pageHeight - 8
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Pagina ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  // Nombre de archivo con marca de tiempo
  const now = new Date();
  const dateSlug = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const defaultFileName = `Historial_Consultas_Normativas_${history.length}_items_${dateSlug}.pdf`;
  const safeFileName = options?.fileName || defaultFileName;

  doc.save(safeFileName);
}

