import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  AlertCircle,
  FileText,
  AlertTriangle,
  BookmarkCheck,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Briefcase,
  HelpCircle,
  ShieldAlert,
  Loader2,
  BookOpen,
  Minimize2,
  Sparkles,
  RefreshCw,
  ListChecks,
  SlidersHorizontal,
  FileDown,
  Bookmark,
} from 'lucide-react';
import {
  ConsultationResponse,
  CitationItem,
  ConsultationHistoryItem,
  NormativeBookmark,
} from '../types/normative';
import { generateConsultationPDF } from '../utils/pdfReportGenerator';
import { downloadSummaryPDF, downloadSummaryTXT } from '../utils/summaryDownloader';
import { DownloadSummaryModal } from './DownloadSummaryModal';
import { useBookmarks } from '../hooks/useBookmarks';
import { AddBookmarkModal } from './AddBookmarkModal';
import { BookmarksModal } from './BookmarksModal';

interface ResponseCardProps {
  response: ConsultationResponse;
  question: string;
  isReadingMode?: boolean;
  onToggleReadingMode?: () => void;
  fontSize?: 'normal' | 'large' | 'xlarge';
  onUpdateKeyPoints?: (newPoints: string[]) => void;
}

const getCategoryBadgeClass = (category: string) => {
  if (category.includes('Constitución') || category === 'CRE') return 'text-purple-800 bg-purple-50 border-purple-200';
  if (category.includes('NEC')) return 'text-blue-800 bg-blue-50 border-blue-200';
  if (category.includes('LOSNCP')) return 'text-emerald-800 bg-emerald-50 border-emerald-200';
  if (category.includes('RGLOSNCP')) return 'text-amber-800 bg-amber-50 border-amber-200';
  if (category.includes('Contraloría') || category === 'LOCGE') return 'text-rose-800 bg-rose-50 border-rose-200';
  if (category.includes('COOTAD')) return 'text-teal-800 bg-teal-50 border-teal-200';
  return 'text-stone-700 bg-stone-100 border-stone-200';
};

export const ResponseCard: React.FC<ResponseCardProps> = ({
  response,
  question,
  isReadingMode = false,
  onToggleReadingMode,
  fontSize = 'normal',
  onUpdateKeyPoints,
}) => {
  const [copiedType, setCopiedType] = useState<'answer' | 'citations' | 'keypoints' | null>(null);
  const [showTechnicalReport, setShowTechnicalReport] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingKeyPoints, setIsGeneratingKeyPoints] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [keyPointsList, setKeyPointsList] = useState<string[]>(response.keyPointsSummary || []);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isDownloadingSummaryPdf, setIsDownloadingSummaryPdf] = useState(false);
  const [isDownloadingSummaryTxt, setIsDownloadingSummaryTxt] = useState(false);
  const [summaryDownloadFeedback, setSummaryDownloadFeedback] = useState<'pdf' | 'txt' | null>(null);

  // Hook de Marcadores (Bookmarks)
  const {
    bookmarks,
    isBookmarked,
    getBookmark,
    addBookmark,
    removeBookmark,
    projects,
    updateBookmarkItem,
    removeAllBookmarks,
  } = useBookmarks();

  const [isAddBookmarkOpen, setIsAddBookmarkOpen] = useState(false);
  const [isViewBookmarksOpen, setIsViewBookmarksOpen] = useState(false);
  const [bookmarkEditingItem, setBookmarkEditingItem] = useState<NormativeBookmark | null>(null);
  const [bookmarkFeedbackToast, setBookmarkFeedbackToast] = useState<string | null>(null);
  const [bookmarkTarget, setBookmarkTarget] = useState<{
    documentName: string;
    category: string;
    articleOrNumeral: string;
    pageNumber: string;
    excerpt: string;
    projectName?: string;
    notes?: string;
    id?: string;
  } | null>(null);

  // Floating selection state
  const [selectionSnippet, setSelectionSnippet] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // All flattened citations available from this response for easy linking
  const flattenedCitations = React.useMemo(() => {
    const list: Array<{
      documentName: string;
      category: string;
      articleOrNumeral: string;
      pageNumber: string;
    }> = [];
    (response.citationsByDocument || []).forEach((g) => {
      (g.citations || []).forEach((c) => {
        list.push({
          documentName: c.documentName || g.documentName,
          category: c.category || g.category,
          articleOrNumeral: c.articleOrNumeral,
          pageNumber: c.pageNumber,
        });
      });
    });
    return list;
  }, [response.citationsByDocument]);

  // Listen for text selection within the consultation response
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionSnippet(null);
        return;
      }
      const text = selection.toString().trim();
      if (text.length >= 8) {
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setSelectionSnippet({
              text,
              x: Math.round(rect.left + rect.width / 2),
              y: Math.round(rect.top + window.scrollY - 8),
            });
            return;
          }
        } catch {
          // ignore selection errors
        }
      }
      setSelectionSnippet(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleTriggerBookmark = (
    cite: CitationItem,
    fallbackDocName?: string,
    fallbackCategory?: string
  ) => {
    const docName = cite.documentName || fallbackDocName || 'Normativa Ecuatoriana';
    const cat = cite.category || fallbackCategory || 'General';
    const existing = getBookmark(docName, cite.articleOrNumeral, cite.literalQuote);

    if (existing) {
      setBookmarkEditingItem(existing);
      setBookmarkTarget({
        id: existing.id,
        documentName: existing.documentName,
        category: existing.category,
        articleOrNumeral: existing.articleOrNumeral,
        pageNumber: existing.pageNumber,
        excerpt: existing.excerpt,
        projectName: existing.projectName,
        notes: existing.notes,
      });
    } else {
      setBookmarkEditingItem(null);
      setBookmarkTarget({
        documentName: docName,
        category: cat,
        articleOrNumeral: cite.articleOrNumeral,
        pageNumber: cite.pageNumber,
        excerpt: cite.literalQuote,
        projectName: projects.length > 0 ? projects[0] : 'General',
        notes: '',
      });
    }
    setIsAddBookmarkOpen(true);
  };

  /**
   * Permite guardar cualquier fragmento específico de la respuesta
   * vinculándolo a la normativa y artículo correspondiente
   */
  const handleBookmarkCustomFragment = (
    excerptText: string,
    suggestedDoc?: string,
    suggestedArticle?: string,
    suggestedPage?: string
  ) => {
    const cleanText = excerptText.trim();
    if (!cleanText) return;

    const firstCite = flattenedCitations[0];
    const docName = suggestedDoc || firstCite?.documentName || 'Normativa de Consulta';
    const cat = firstCite?.category || 'General';
    const art = suggestedArticle || firstCite?.articleOrNumeral || 'Art. de Referencia';
    const page = suggestedPage || firstCite?.pageNumber || 'Pág.: s/n';

    const existing = getBookmark(docName, art, cleanText);
    if (existing) {
      setBookmarkEditingItem(existing);
      setBookmarkTarget({
        id: existing.id,
        documentName: existing.documentName,
        category: existing.category,
        articleOrNumeral: existing.articleOrNumeral,
        pageNumber: existing.pageNumber,
        excerpt: existing.excerpt,
        projectName: existing.projectName,
        notes: existing.notes,
      });
    } else {
      setBookmarkEditingItem(null);
      setBookmarkTarget({
        documentName: docName,
        category: cat,
        articleOrNumeral: art,
        pageNumber: page,
        excerpt: cleanText,
        projectName: projects.length > 0 ? projects[0] : 'General',
        notes: '',
      });
    }
    setSelectionSnippet(null);
    setIsAddBookmarkOpen(true);
  };

  const handleSaveBookmarkFromModal = async (data: {
    projectName: string;
    notes: string;
    tags: string[];
    documentName?: string;
    category?: string;
    articleOrNumeral?: string;
    pageNumber?: string;
    excerpt?: string;
  }) => {
    if (!bookmarkTarget) return;
    try {
      const finalDocName = data.documentName || bookmarkTarget.documentName;
      const finalCategory = data.category || bookmarkTarget.category;
      const finalArticle = data.articleOrNumeral || bookmarkTarget.articleOrNumeral;
      const finalPage = data.pageNumber || bookmarkTarget.pageNumber;
      const finalExcerpt = data.excerpt || bookmarkTarget.excerpt;

      if (bookmarkEditingItem) {
        await updateBookmarkItem(bookmarkEditingItem.id, {
          documentName: finalDocName,
          category: finalCategory,
          articleOrNumeral: finalArticle,
          pageNumber: finalPage,
          excerpt: finalExcerpt,
          projectName: data.projectName,
          notes: data.notes,
          tags: data.tags,
        });
        setBookmarkFeedbackToast(`¡Marcador actualizado para el proyecto "${data.projectName}"!`);
      } else {
        await addBookmark({
          documentName: finalDocName,
          category: finalCategory,
          articleOrNumeral: finalArticle,
          pageNumber: finalPage,
          excerpt: finalExcerpt,
          questionContext: question,
          projectName: data.projectName,
          notes: data.notes,
          tags: data.tags,
        });
        setBookmarkFeedbackToast(`¡Fragmento guardado en marcadores para el proyecto "${data.projectName}"!`);
      }
      setTimeout(() => setBookmarkFeedbackToast(null), 3500);
    } catch (err) {
      console.error('Error guardando marcador:', err);
    }
  };

  useEffect(() => {
    if (response.keyPointsSummary && response.keyPointsSummary.length > 0) {
      setKeyPointsList(response.keyPointsSummary);
    }
  }, [response.keyPointsSummary]);

  const handleGenerateKeyPoints = async () => {
    try {
      setIsGeneratingKeyPoints(true);
      const res = await fetch('/api/generar-resumen-puntos-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          directAnswer: response.directAnswer,
        }),
      });
      if (!res.ok) throw new Error('Error al generar resumen de puntos clave');
      const data = await res.json();
      if (data.keyPoints && Array.isArray(data.keyPoints)) {
        setKeyPointsList(data.keyPoints);
        if (onUpdateKeyPoints) {
          onUpdateKeyPoints(data.keyPoints);
        }
      }
    } catch (err) {
      console.error('Error generando puntos clave:', err);
    } finally {
      setIsGeneratingKeyPoints(false);
    }
  };

  const handleCopyKeyPoints = () => {
    if (!keyPointsList || keyPointsList.length === 0) return;
    let text = `CONSULTOR NORMATIVO ECUADOR - PUNTOS CLAVE\n`;
    text += `CONSULTA: ${question}\n\n`;
    keyPointsList.forEach((point, idx) => {
      text += `${idx + 1}. ${point}\n`;
    });
    text += `\nNormativa técnica y de contratación pública ecuatoriana (NEC / LOSNCP).`;
    copyToClipboard(text, 'keypoints');
  };

  /**
   * Descarga directa de la Ficha Técnica de Conclusiones para Obra en PDF
   */
  const handleDownloadSummaryPDF = async () => {
    let currentPoints = keyPointsList;
    if (!currentPoints || currentPoints.length === 0) {
      try {
        setIsGeneratingKeyPoints(true);
        const res = await fetch('/api/generar-resumen-puntos-clave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            directAnswer: response.directAnswer,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.keyPoints && Array.isArray(data.keyPoints)) {
            currentPoints = data.keyPoints;
            setKeyPointsList(currentPoints);
            if (onUpdateKeyPoints) onUpdateKeyPoints(currentPoints);
          }
        }
      } catch (err) {
        console.error('Error generando puntos antes de PDF:', err);
      } finally {
        setIsGeneratingKeyPoints(false);
      }
    }

    try {
      setIsDownloadingSummaryPdf(true);
      await downloadSummaryPDF({
        question,
        keyPoints: currentPoints && currentPoints.length > 0 ? currentPoints : [response.directAnswer],
        directAnswer: response.directAnswer,
        confidenceLabel: response.confidenceLabel,
        documentNames:
          response.usedDocuments?.map((d) => d.name) ||
          response.citationsByDocument?.map((c) => c.documentName) ||
          [],
        citations: response.citationsByDocument,
        timestamp: response.queryDate,
      });
      setSummaryDownloadFeedback('pdf');
      setTimeout(() => setSummaryDownloadFeedback(null), 3000);
    } catch (err) {
      console.error('Error al generar Ficha PDF de conclusiones:', err);
    } finally {
      setIsDownloadingSummaryPdf(false);
    }
  };

  /**
   * Descarga directa de las conclusiones y resumen en Texto Plano (.txt)
   */
  const handleDownloadSummaryTXT = async () => {
    let currentPoints = keyPointsList;
    if (!currentPoints || currentPoints.length === 0) {
      try {
        setIsGeneratingKeyPoints(true);
        const res = await fetch('/api/generar-resumen-puntos-clave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            directAnswer: response.directAnswer,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.keyPoints && Array.isArray(data.keyPoints)) {
            currentPoints = data.keyPoints;
            setKeyPointsList(currentPoints);
            if (onUpdateKeyPoints) onUpdateKeyPoints(currentPoints);
          }
        }
      } catch (err) {
        console.error('Error generando puntos antes de TXT:', err);
      } finally {
        setIsGeneratingKeyPoints(false);
      }
    }

    try {
      setIsDownloadingSummaryTxt(true);
      downloadSummaryTXT({
        question,
        keyPoints: currentPoints && currentPoints.length > 0 ? currentPoints : [response.directAnswer],
        directAnswer: response.directAnswer,
        confidenceLabel: response.confidenceLabel,
        documentNames:
          response.usedDocuments?.map((d) => d.name) ||
          response.citationsByDocument?.map((c) => c.documentName) ||
          [],
        citations: response.citationsByDocument,
        timestamp: response.queryDate,
      });
      setSummaryDownloadFeedback('txt');
      setTimeout(() => setSummaryDownloadFeedback(null), 3000);
    } catch (err) {
      console.error('Error al generar TXT de conclusiones:', err);
    } finally {
      setIsDownloadingSummaryTxt(false);
    }
  };

  const getDirectAnswerClass = () => {
    if (fontSize === 'xlarge') return 'text-lg sm:text-xl leading-relaxed';
    if (fontSize === 'large') return 'text-base sm:text-lg leading-relaxed';
    return 'text-sm sm:text-base leading-relaxed';
  };

  const getQuoteClass = () => {
    if (fontSize === 'xlarge') return 'text-base sm:text-lg leading-relaxed';
    if (fontSize === 'large') return 'text-sm sm:text-base leading-relaxed';
    return 'text-xs sm:text-sm leading-relaxed';
  };

  const handleDownloadPDFReport = async () => {
    try {
      setIsGeneratingPdf(true);
      const item: ConsultationHistoryItem = {
        id: `rep_${Date.now()}`,
        question,
        response: {
          ...response,
          keyPointsSummary: keyPointsList,
        },
        timestamp: response.queryDate || new Date().toISOString(),
        documentNames:
          response.usedDocuments?.map((d) => d.name) ||
          response.citationsByDocument?.map((c) => c.documentName) ||
          [],
        mode: response.mode,
      };
      await generateConsultationPDF(item);
    } catch (err) {
      console.error('Error al generar PDF con jsPDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'answer' | 'citations' | 'keypoints') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.error('Error copying text:', err);
    }
  };

  const handleCopyResponseAndCitations = () => {
    let text = `CONSULTOR NORMATIVO ECUADOR\n`;
    text += `CONSULTA TÉCNICA: ${question}\n`;
    text += `ESTADO DE EVIDENCIA: ${response.confidenceLabel || 'Respaldo normativo'}\n`;
    text += `FECHA DE CONSULTA: ${response.queryDate || new Date().toLocaleDateString('es-EC')}\n\n`;

    text += `1. RESPUESTA TÉCNICA:\n${response.directAnswer}\n\n`;

    if (keyPointsList.length > 0) {
      text += `RESUMEN DE PUNTOS CLAVE (SÍNTESIS EJECUTIVA):\n`;
      keyPointsList.forEach((point, idx) => {
        text += `• ${point}\n`;
      });
      text += `\n`;
    }

    if (response.contradictions) {
      text += `CONTRADICCIÓN / DISCREPANCIA:\n${response.contradictions}\n\n`;
    }

    if (response.citationsByDocument && response.citationsByDocument.length > 0) {
      text += `2. FUNDAMENTO NORMATIVO (CITAS LITERALES):\n`;
      response.citationsByDocument.forEach((group) => {
        text += `\n[${group.documentName} - ${group.category}]\n`;
        group.citations.forEach((c) => {
          text += `[${c.documentName || group.documentName}] – ${c.articleOrNumeral} – ${c.pageNumber}\n`;
          text += `Texto literal: "${c.literalQuote}"\n\n`;
        });
      });
    }

    if (response.caseApplication) {
      text += `3. APLICACIÓN AL CASO EN OBRA PÚBLICA:\n${response.caseApplication}\n\n`;
    }

    if (response.observations) {
      text += `4. OBSERVACIONES Y ADVERTENCIAS:\n${response.observations}\n\n`;
    }

    text += `Herramienta de apoyo profesional. Verifique siempre las citas en el documento oficial correspondiente.`;
    copyToClipboard(text, 'answer');
  };

  const handleCopyCitations = () => {
    if (!response.citationsByDocument || response.citationsByDocument.length === 0) return;
    let text = `FUNDAMENTO NORMATIVO Y CITAS LITERALES:\n\n`;
    response.citationsByDocument.forEach((group) => {
      text += `[${group.documentName} - ${group.category}]\n`;
      group.citations.forEach((c) => {
        text += `[${c.documentName || group.documentName}] – ${c.articleOrNumeral} – ${c.pageNumber}\n`;
        text += `Texto literal: "${c.literalQuote}"\n\n`;
      });
    });
    copyToClipboard(text, 'citations');
  };

  const handleDownloadWordDoc = () => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Informe Normativo</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #1c1917; }
          h1 { font-size: 16pt; color: #0c0a09; text-transform: uppercase; border-bottom: 2pt solid #1c1917; padding-bottom: 4pt; }
          h2 { font-size: 13pt; color: #292524; margin-top: 14pt; border-bottom: 1pt solid #d6d3d1; }
          .quote-box { background-color: #f5f5f4; border-left: 3pt solid #78716c; padding: 8pt; margin: 6pt 0; font-style: italic; }
          .badge { font-weight: bold; color: #047857; }
          .footer { font-size: 9pt; color: #78716c; margin-top: 20pt; border-top: 1pt solid #e7e5e4; padding-top: 6pt; }
        </style>
      </head>
      <body>
        <h1>Consultor Normativo Ecuador</h1>
        <p><strong>Consulta:</strong> ${question}</p>
        <p><strong>Fecha de Emisión:</strong> ${response.queryDate || new Date().toLocaleDateString('es-EC')}</p>
        <p><strong>Estado de Respaldo:</strong> ${response.confidenceLabel || 'Respaldo normativo verificado'}</p>
        
        <h2>1. Respuesta Técnica Directa</h2>
        <p>${response.directAnswer.replace(/\n/g, '<br>')}</p>
        
        ${
          keyPointsList.length > 0
            ? `<h2>Resumen de Puntos Clave (Síntesis Ejecutiva)</h2>
               <div style="background-color: #fef3c7; border-left: 3pt solid #d97706; padding: 8pt; margin: 8pt 0;">
                 <ul style="margin: 0; padding-left: 18pt;">
                   ${keyPointsList.map((p) => `<li>${p}</li>`).join('')}
                 </ul>
               </div>`
            : ''
        }
        
        ${
          response.citationsByDocument && response.citationsByDocument.length > 0
            ? `<h2>2. Fundamento Normativo (Citas Literales)</h2>` +
              response.citationsByDocument
                .map(
                  (group) => `
                <h3>[${group.documentName}] &mdash; ${group.category}</h3>
                ${group.citations
                  .map(
                    (c) => `
                  <p><strong>[${c.documentName || group.documentName}] &ndash; ${c.articleOrNumeral} &ndash; ${c.pageNumber}</strong></p>
                  <div class="quote-box">Texto literal: &ldquo;${c.literalQuote}&rdquo;</div>
                `
                  )
                  .join('')}
              `
                )
                .join('')
            : ''
        }

        ${
          response.technicalReport
            ? `<h2>3. Estructura de Informe Técnico</h2>
               <p><strong>Antecedentes:</strong> ${response.technicalReport.antecedentes}</p>
               <p><strong>Objeto:</strong> ${response.technicalReport.objeto}</p>
               <p><strong>Base Legal:</strong> ${response.technicalReport.baseLegal}</p>
               <p><strong>Análisis:</strong> ${response.technicalReport.analisis}</p>
               <p><strong>Fundamento Técnico:</strong> ${response.technicalReport.fundamentoTecnico}</p>
               <p><strong>Conclusiones:</strong> ${response.technicalReport.conclusiones}</p>
               <p><strong>Recomendaciones:</strong> ${response.technicalReport.recomendaciones}</p>
              `
            : ''
        }

        ${
          response.caseApplication
            ? `<h2>4. Aplicación al Caso en Obra Pública</h2>
               <p>${response.caseApplication}</p>`
            : ''
        }

        <div class="footer">
          Herramienta de apoyo profesional. Verifique siempre las citas en el Registro Oficial correspondiente.
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Criterio_Normativo_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden transition-all">
      {/* Top Header & Evidence Confidence Indicator */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {response.status === 'FOUND' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
              {response.confidenceLabel || 'Respaldo Alto'}
            </span>
          )}

          {response.status === 'PARTIAL' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              {response.confidenceLabel || 'Respaldo Parcial'}
            </span>
          )}

          {(response.status === 'NOT_FOUND' || response.status === 'INSUFFICIENT_EVIDENCE') && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 bg-stone-100 border border-stone-300 px-2.5 py-1 rounded-md">
              <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
              {response.confidenceLabel || 'Sin Respaldo en Documentos'}
            </span>
          )}

          {response.status === 'CONFLICT' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
              Discrepancia o Contradicción
            </span>
          )}
        </div>

        {/* Action Buttons: Reading Mode, Copy, Word Doc, Print */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onToggleReadingMode && (
            <button
              type="button"
              onClick={onToggleReadingMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border min-h-[40px] sm:min-h-0 ${
                isReadingMode
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'
              }`}
              title={isReadingMode ? 'Salir del Modo Lectura (Esc)' : 'Modo Lectura: maximizar el área de visualización del texto de la respuesta'}
            >
              {isReadingMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-800" />
                  <span>Salir Modo Lectura</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                  <span>Modo Lectura</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyResponseAndCitations}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors min-h-[40px] sm:min-h-0 ${
              copiedType === 'answer'
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-900 text-white hover:bg-stone-800'
            }`}
            title="Copiar texto de la respuesta y citas al portapapeles con un solo clic"
          >
            {copiedType === 'answer' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>¡Respuesta copiada!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar respuesta</span>
              </>
            )}
          </button>

          {response.citationsByDocument && response.citationsByDocument.length > 0 && (
            <button
              type="button"
              onClick={handleCopyCitations}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-stone-200 min-h-[40px] sm:min-h-0 ${
                copiedType === 'citations'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white text-stone-700 hover:bg-stone-50'
              }`}
              title="Copiar únicamente el fundamento normativo y citas exactas"
            >
              {copiedType === 'citations' ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span>Copiar Citas</span>
            </button>
          )}

          {/* Botón de Acceso a Marcadores de Proyectos */}
          <button
            type="button"
            onClick={() => setIsViewBookmarksOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 min-h-[40px] sm:min-h-0 shadow-2xs"
            title="Ver fragmentos y citas normativas guardadas en marcadores de proyectos"
          >
            <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
            <span>Marcadores</span>
            {bookmarks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-[10px] font-mono font-bold text-amber-950">
                {bookmarks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadPDFReport}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg transition-colors min-h-[40px] sm:min-h-0 disabled:opacity-50"
            title="Descargar reporte en formato PDF con citas normativas (jsPDF)"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-700" />
                <span className="hidden sm:inline">Generando...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-red-600" />
                <span>PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadWordDoc}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg transition-colors min-h-[40px] sm:min-h-0"
            title="Descargar informe técnico en formato Word (.doc)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Word</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors hidden sm:flex items-center justify-center"
            title="Imprimir o guardar como PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* User Question */}
        <div className="text-xs text-stone-500 border-l-2 border-stone-400 pl-3 py-0.5">
          <span className="font-semibold text-stone-700">Consulta:</span> {question}
        </div>

        {/* Contradiction Warning Banner if detected */}
        {response.contradictions && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-950 space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-orange-900">
              <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Discrepancia o Posible Contradicción entre Cuerpos Normativos</span>
            </div>
            <p className="leading-relaxed pl-6 text-orange-900">{response.contradictions}</p>
          </div>
        )}

        {/* Layer 1: Direct Technical Answer */}
        <div>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              1. Respuesta Técnica Directa
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleBookmarkCustomFragment(response.directAnswer)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border bg-white text-amber-900 border-amber-300 hover:bg-amber-50 shadow-2xs"
                title="Guardar fragmento de esta respuesta en marcadores citando la normativa y artículo correspondiente"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                <span>Guardar en Marcador</span>
              </button>

              <button
                type="button"
                onClick={handleCopyResponseAndCitations}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                  copiedType === 'answer'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-white text-stone-700 hover:text-stone-950 border-stone-200 hover:bg-stone-50'
                }`}
                title="Copiar texto de la respuesta y citas al portapapeles con un solo clic"
              >
                {copiedType === 'answer' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold text-emerald-700">¡Respuesta copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar respuesta</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div className={`${getDirectAnswerClass()} text-stone-900 font-normal bg-stone-50/70 p-4 rounded-xl border border-stone-200/80 whitespace-pre-wrap`}>
            {response.directAnswer}
          </div>
          <div className="flex items-center justify-between pt-1.5 text-[11px] text-stone-400">
            <span className="italic flex items-center gap-1">
              <span>💡</span>
              <span>Puedes seleccionar cualquier fragmento de texto con el cursor para guardarlo como marcador de proyecto.</span>
            </span>
          </div>
        </div>

        {/* Resumen de Puntos Clave (Síntesis Ejecutiva para Rápida Comprensión en Obra) */}
        <div className="bg-gradient-to-br from-amber-50/70 via-white to-stone-50/60 rounded-xl border border-amber-200/80 shadow-2xs overflow-hidden transition-all">
          <div className="p-3.5 sm:p-4 bg-amber-100/50 border-b border-amber-200/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-amber-700" />
                    <span>Resumen de Puntos Clave</span>
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                    Síntesis Rápida
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80">
                  Conceptos esenciales, plazos y parámetros críticos para rápida comprensión en obra y fiscalización
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {keyPointsList.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyKeyPoints}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border min-h-[36px] sm:min-h-0 ${
                      copiedType === 'keypoints'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-white text-stone-700 hover:text-stone-900 border-amber-200 hover:bg-amber-50'
                    }`}
                    title="Copiar únicamente la síntesis de puntos clave al portapapeles"
                  >
                    {copiedType === 'keypoints' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-semibold text-emerald-700">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-500" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  {/* Descarga directa PDF de conclusiones */}
                  <button
                    type="button"
                    onClick={handleDownloadSummaryPDF}
                    disabled={isDownloadingSummaryPdf}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border bg-amber-600 hover:bg-amber-700 text-white border-amber-600 disabled:opacity-50 min-h-[36px] sm:min-h-0 shadow-2xs"
                    title="Descargar Ficha Técnica de Conclusiones en formato PDF para informes de obra"
                  >
                    {isDownloadingSummaryPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : summaryDownloadFeedback === 'pdf' ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>{summaryDownloadFeedback === 'pdf' ? '¡PDF Listo!' : 'PDF Obra'}</span>
                  </button>

                  {/* Descarga directa TXT de conclusiones */}
                  <button
                    type="button"
                    onClick={handleDownloadSummaryTXT}
                    disabled={isDownloadingSummaryTxt}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border bg-white text-stone-700 hover:text-stone-900 border-amber-200 hover:bg-amber-50 disabled:opacity-50 min-h-[36px] sm:min-h-0"
                    title="Descargar conclusiones en texto plano (.txt) para bitácora o libro de obra"
                  >
                    {isDownloadingSummaryTxt ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
                    ) : summaryDownloadFeedback === 'txt' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-amber-700" />
                    )}
                    <span>{summaryDownloadFeedback === 'txt' ? '¡TXT Listo!' : 'TXT'}</span>
                  </button>

                  {/* Abrir modal para personalizar datos del informe de obra */}
                  <button
                    type="button"
                    onClick={() => setIsSummaryModalOpen(true)}
                    className="p-1.5 text-stone-600 hover:text-amber-900 hover:bg-amber-200/50 rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center border border-amber-200/60 bg-white"
                    title="Personalizar proyecto, nombres de residentes y folio de bitácora antes de descargar"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-800" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleGenerateKeyPoints}
                disabled={isGeneratingKeyPoints}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border bg-white text-amber-900 border-amber-200 hover:bg-amber-50 disabled:opacity-50 min-h-[36px] sm:min-h-0"
                title="Generar o regenerar la síntesis de puntos clave con inteligencia artificial"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isGeneratingKeyPoints ? 'animate-spin' : ''}`} />
                <span>{isGeneratingKeyPoints ? 'Sintetizando...' : keyPointsList.length > 0 ? 'Regenerar' : 'Generar Puntos'}</span>
              </button>

              {keyPointsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowKeyPoints(!showKeyPoints)}
                  className="p-1 text-stone-500 hover:text-stone-800 rounded-md transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                  title={showKeyPoints ? 'Minimizar puntos clave' : 'Expandir puntos clave'}
                >
                  {showKeyPoints ? <ChevronUp className="w-4 h-4 text-stone-600" /> : <ChevronDown className="w-4 h-4 text-stone-600" />}
                </button>
              )}
            </div>
          </div>

          {/* List of Key Points */}
          {showKeyPoints && (
            <div className="p-4 sm:p-5">
              {keyPointsList.length > 0 ? (
                <>
                  <ul className="space-y-2.5">
                    {keyPointsList.map((point, idx) => (
                      <li
                        key={idx}
                        className="group flex items-start justify-between gap-3 p-3 rounded-lg bg-white/95 border border-amber-200/60 hover:border-amber-400 transition-colors shadow-2xs"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                            {point}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBookmarkCustomFragment(point)}
                          className="opacity-70 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-stone-600 hover:text-amber-950 hover:bg-amber-100 border border-transparent hover:border-amber-300 transition-all shrink-0 cursor-pointer"
                          title="Guardar este punto clave en Marcadores de proyectos"
                        >
                          <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                          <span className="hidden sm:inline text-[10px]">Guardar</span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Barra de acción para informes de obra */}
                  <div className="mt-4 pt-3.5 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <FileDown className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">
                          Guardar conclusiones para informes de obra
                        </span>
                        <span className="text-[11px] text-amber-800/90 block">
                          Formato preparado para anexar a planillas, bitácora y memorandos de fiscalización
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleDownloadSummaryPDF}
                        disabled={isDownloadingSummaryPdf}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-2xs hover:shadow-xs transition-all disabled:opacity-50 min-h-[36px] sm:min-h-0"
                        title="Descargar Ficha Técnica en PDF formal para informe de obra"
                      >
                        {isDownloadingSummaryPdf ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : summaryDownloadFeedback === 'pdf' ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{summaryDownloadFeedback === 'pdf' ? '¡PDF Descargado!' : 'Descargar PDF (Ficha)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadSummaryTXT}
                        disabled={isDownloadingSummaryTxt}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 transition-colors shadow-2xs disabled:opacity-50 min-h-[36px] sm:min-h-0"
                        title="Descargar conclusiones en formato texto plano (.txt) para bitácora o libro de obra"
                      >
                        {isDownloadingSummaryTxt ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                        ) : summaryDownloadFeedback === 'txt' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-amber-800" />
                        )}
                        <span>{summaryDownloadFeedback === 'txt' ? '¡TXT Descargado!' : 'Descargar TXT (.txt)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsSummaryModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-amber-50 text-stone-700 hover:text-amber-900 border border-amber-200 transition-colors min-h-[36px] sm:min-h-0"
                        title="Personalizar proyecto, residente, fiscalizador y folio de libro de obra antes de descargar"
                      >
                        <SlidersHorizontal className="w-3 h-3 text-stone-500" />
                        <span>Personalizar...</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-stone-500">
                    Genera una síntesis ejecutiva de puntos clave para comprender esta normativa compleja rápidamente.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateKeyPoints}
                    disabled={isGeneratingKeyPoints}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingKeyPoints ? 'Generando síntesis...' : 'Generar Resumen de Puntos Clave'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unverified Suggestion if not found */}
        {response.unverifiedSuggestion && (
          <div className="p-4 bg-stone-100/90 border border-stone-200 rounded-xl text-xs text-stone-700 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-stone-900">
              <HelpCircle className="w-4 h-4 text-stone-500 shrink-0" />
              <span>Sugerencia orientativa (no verificada en documentos cargados)</span>
            </div>
            <p className="leading-relaxed pl-5 text-stone-600">
              {response.unverifiedSuggestion}
            </p>
          </div>
        )}

        {/* Layer 2: Normative Basis (Fundamento Normativo con Citas Literales) */}
        {response.citationsByDocument && response.citationsByDocument.length > 0 && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-stone-700" />
                <span>2. Fundamento Normativo</span>
              </h3>
              <span className="text-[11px] text-stone-500">
                Páginas correspondientes al archivo PDF
              </span>
            </div>

            {/* Citations separated by document */}
            <div className="space-y-4">
              {response.citationsByDocument.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900">
                      [{group.documentName}]
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getCategoryBadgeClass(group.category)}`}>
                      {group.category}
                    </span>
                  </div>

                  <div className="space-y-3 pl-1 sm:pl-3">
                    {group.citations.map((cite: CitationItem, citeIdx: number) => (
                      <div
                        key={citeIdx}
                        className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2 text-xs"
                      >
                        {/* Citation Header Format: [Documento] – Art./Numeral [X] – Pág. [N del PDF] */}
                        <div className="font-semibold text-stone-800 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-stone-900">
                              [{cite.documentName || group.documentName}]
                            </span>
                            <span className="text-stone-400">–</span>
                            <span className="text-stone-900 font-mono font-bold">
                              {cite.articleOrNumeral}
                            </span>
                            <span className="text-stone-400">–</span>
                            <span className="bg-stone-200 text-stone-800 px-2 py-0.5 rounded text-[11px] font-mono">
                              {cite.pageNumber}
                            </span>
                            {cite.verified && (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px] flex items-center gap-1 font-sans">
                                <FileCheck2 className="w-3 h-3 text-emerald-600" /> Cita verificada
                              </span>
                            )}
                          </div>

                          {/* Acciones de Cita: Guardar Marcador y Copiar */}
                          <div className="flex items-center gap-1">
                            {(() => {
                              const docName = cite.documentName || group.documentName;
                              const bookmarked = isBookmarked(docName, cite.articleOrNumeral, cite.literalQuote);
                              const existingBm = getBookmark(docName, cite.articleOrNumeral, cite.literalQuote);

                              return (
                                <button
                                  type="button"
                                  onClick={() => handleTriggerBookmark(cite, group.documentName, group.category)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all ${
                                    bookmarked
                                      ? 'bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs font-bold hover:bg-amber-200'
                                      : 'bg-white text-stone-600 hover:text-amber-900 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 font-medium'
                                  }`}
                                  title={
                                    bookmarked
                                      ? `En marcadores (${existingBm?.projectName || 'General'}). Clic para editar proyecto o nota.`
                                      : 'Guardar este fragmento específico en marcadores para futuros proyectos'
                                  }
                                >
                                  <Bookmark
                                    className={`w-3.5 h-3.5 ${
                                      bookmarked ? 'fill-amber-500 text-amber-600' : 'text-stone-400'
                                    }`}
                                  />
                                  <span>
                                    {bookmarked
                                      ? existingBm?.projectName
                                        ? `En "${existingBm.projectName}"`
                                        : 'En Marcadores'
                                      : 'Guardar Marcador'}
                                  </span>
                                </button>
                              );
                            })()}

                            <button
                              type="button"
                              onClick={async () => {
                                const docName = cite.documentName || group.documentName;
                                const text = `[${docName}] – ${cite.articleOrNumeral} – ${cite.pageNumber}\nTexto literal: "${cite.literalQuote.replace(/^["']|["']$/g, '')}"`;
                                await navigator.clipboard.writeText(text);
                                setCopiedType('citations');
                                setTimeout(() => setCopiedType(null), 1500);
                              }}
                              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-md transition-colors"
                              title="Copiar únicamente esta cita y fragmento"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Literal quote: Texto literal: "..." */}
                        <div className="text-stone-700 leading-relaxed font-sans bg-white p-3 rounded-lg border border-stone-200/60">
                          <span className="font-semibold text-stone-900 block text-[11px] text-stone-500 mb-1">
                            Texto literal:
                          </span>
                          <blockquote className={`${getQuoteClass()} italic border-l-2 border-stone-400 pl-2.5 text-stone-800`}>
                            "{cite.literalQuote.replace(/^["']|["']$/g, '')}"
                          </blockquote>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Report Section if mode === 'informe' */}
        {response.technicalReport && (
          <div className="pt-2 border-t border-stone-200 space-y-3">
            <button
              type="button"
              onClick={() => setShowTechnicalReport(!showTechnicalReport)}
              className="w-full flex items-center justify-between p-3 bg-stone-100 hover:bg-stone-200/70 rounded-xl transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-stone-700" />
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Estructura de Informe Técnico de Fiscalización
                </span>
              </div>
              {showTechnicalReport ? <ChevronUp className="w-4 h-4 text-stone-600" /> : <ChevronDown className="w-4 h-4 text-stone-600" />}
            </button>

            {showTechnicalReport && (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3 text-xs text-stone-800 leading-relaxed animate-in fade-in">
                <div>
                  <h4 className="font-bold text-stone-900 mb-0.5">1. Antecedentes y Objeto</h4>
                  <p className="text-stone-600">{response.technicalReport.antecedentes} {response.technicalReport.objeto}</p>
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 mb-0.5">2. Base Legal</h4>
                  <p className="text-stone-600 font-mono text-[11px]">{response.technicalReport.baseLegal}</p>
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 mb-0.5">3. Análisis Técnico-Jurídico</h4>
                  <p className="text-stone-600">{response.technicalReport.analisis}</p>
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 mb-0.5">4. Fundamento Técnico en Obra</h4>
                  <p className="text-stone-600">{response.technicalReport.fundamentoTecnico || 'No desarrollado en la respuesta del modelo.'}</p>
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 mb-0.5">5. Conclusiones y Recomendaciones</h4>
                  <p className="text-stone-600">{[response.technicalReport.conclusiones, response.technicalReport.recomendaciones].filter(Boolean).join(' ') || 'No desarrollado en la respuesta del modelo.'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Layer 3: Application to Case in Public Works */}
        {response.caseApplication && (
          <div className="pt-2 border-t border-stone-100">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
              3. Aplicación en Obra Pública y Fiscalización
            </h3>
            <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3.5 rounded-xl border border-stone-200/70">
              {response.caseApplication}
            </p>
          </div>
        )}

        {/* Layer 4: Observations & Legal Disclaimer */}
        <div className="pt-2 border-t border-stone-100">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
            4. Observaciones y Advertencias Técnicas
          </h3>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            {response.observations}
          </p>
        </div>

        {/* PDF Page clarification notice */}
        <div className="text-[11px] text-stone-400 italic pt-1">
          * La numeración de página indicada corresponde a la posición correlativa de la página dentro del archivo PDF cargado.
        </div>
      </div>

      {/* Modal para Descargar Conclusiones y Personalizar Datos de Obra */}
      <DownloadSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        question={question}
        keyPoints={keyPointsList.length > 0 ? keyPointsList : [response.directAnswer]}
        directAnswer={response.directAnswer}
        confidenceLabel={response.confidenceLabel}
        documentNames={
          response.usedDocuments?.map((d) => d.name) ||
          response.citationsByDocument?.map((c) => c.documentName) ||
          []
        }
        citations={response.citationsByDocument}
        timestamp={response.queryDate}
      />

      {/* Floating Selection Tooltip for Highlighting Text to Bookmark */}
      {selectionSnippet && (
        <div
          style={{
            position: 'fixed',
            left: `${selectionSnippet.x}px`,
            top: `${selectionSnippet.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-50 pointer-events-auto animate-in zoom-in-95 duration-150"
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleBookmarkCustomFragment(selectionSnippet.text);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-bold shadow-xl border border-amber-400 hover:bg-stone-800 transition-all hover:scale-105 cursor-pointer"
            title="Guardar este fragmento seleccionado en Marcadores para proyectos futuros"
          >
            <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Guardar selección en Marcador</span>
          </button>
        </div>
      )}

      {/* Modal para Agregar / Editar Marcador de Proyecto */}
      <AddBookmarkModal
        isOpen={isAddBookmarkOpen}
        onClose={() => setIsAddBookmarkOpen(false)}
        onSave={handleSaveBookmarkFromModal}
        initialData={bookmarkTarget || undefined}
        availableCitations={flattenedCitations}
        existingProjects={projects}
        isEditing={!!bookmarkEditingItem}
      />

      {/* Modal / Drawer para Explorar todos los Marcadores */}
      <BookmarksModal
        isOpen={isViewBookmarksOpen}
        onClose={() => setIsViewBookmarksOpen(false)}
        bookmarks={bookmarks}
        onDeleteBookmark={removeBookmark}
        onEditBookmark={(b) => {
          setBookmarkEditingItem(b);
          setBookmarkTarget({
            id: b.id,
            documentName: b.documentName,
            category: b.category,
            articleOrNumeral: b.articleOrNumeral,
            pageNumber: b.pageNumber,
            excerpt: b.excerpt,
            projectName: b.projectName,
            notes: b.notes,
          });
          setIsViewBookmarksOpen(false);
          setIsAddBookmarkOpen(true);
        }}
        onClearAllBookmarks={removeAllBookmarks}
      />

      {/* Toast flotante de confirmación de marcador */}
      {bookmarkFeedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-4 duration-200 border border-stone-800">
          <Bookmark className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
          <span>{bookmarkFeedbackToast}</span>
          <button
            type="button"
            onClick={() => setIsViewBookmarksOpen(true)}
            className="underline text-amber-300 hover:text-amber-200 font-bold ml-1"
          >
            Ver marcadores
          </button>
        </div>
      )}
    </div>
  );
};
