import React, { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Copy,
  Check,
  FileText,
  AlertCircle,
  Download,
  Loader2,
  FileSpreadsheet,
  FileJson,
  HardDriveDownload,
  Sparkles,
  FileDown,
  X,
  Filter,
  Tag,
  Tags,
  Plus,
} from 'lucide-react';
import { ConsultationHistoryItem } from '../types/normative';
import { ResponseCard } from './ResponseCard';
import { generateConsultationPDF } from '../utils/pdfReportGenerator';
import {
  exportConsultationHistoryJSON,
  exportConsultationHistoryCSV,
  exportConsultationHistoryPDF,
} from '../utils/exportHistory';
import {
  downloadSummaryPDF,
  downloadSummaryTXT,
} from '../utils/summaryDownloader';
import { getConsultationHistory, updateConsultationHistoryItem } from '../services/db';

const PRESET_CATEGORIES = [
  'NEC',
  'LOSNCP',
  'RGLOSNCP',
  'Contratación',
  'SERCOP',
  'Fiscalización',
  'Garantías',
  'Anticipo',
  'Multas',
  'Recepción de Obra',
  'Estructural',
];

/**
 * Resalta visualmente las palabras clave coincidentes en el texto.
 */
const HighlightText: React.FC<{ text: string; query: string; className?: string }> = ({
  text,
  query,
  className = '',
}) => {
  if (!query.trim() || !text) {
    return <span className={className}>{text}</span>;
  }

  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return <span className={className}>{text}</span>;

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-200/90 text-amber-950 font-semibold px-0.5 rounded-xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

interface HistoryViewProps {
  history: ConsultationHistoryItem[];
  onSelectQuestion: (question: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateItem?: (id: string, updates: Partial<ConsultationHistoryItem>) => Promise<void>;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onSelectQuestion,
  onDeleteItem,
  onUpdateItem,
  onClearHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingTagsItemId, setEditingTagsItemId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [generatingSummaryPdfId, setGeneratingSummaryPdfId] = useState<string | null>(null);
  const [generatingSummaryTxtId, setGeneratingSummaryTxtId] = useState<string | null>(null);
  const [downloadSummarySuccessId, setDownloadSummarySuccessId] = useState<{ id: string; type: 'pdf' | 'txt' } | null>(null);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportedFormat, setExportedFormat] = useState<'json' | 'csv' | 'pdf' | null>(null);
  const [exportBannerMsg, setExportBannerMsg] = useState<string | null>(null);

  // Recopilar todas las etiquetas únicas presentes en el historial con su frecuencia
  const allUniqueTags = useMemo(() => {
    const tagCountMap = new Map<string, number>();
    history.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        const trimmed = tag.trim();
        if (trimmed) {
          tagCountMap.set(trimmed, (tagCountMap.get(trimmed) || 0) + 1);
        }
      });
    });
    return Array.from(tagCountMap.entries()).map(([tag, count]) => ({ tag, count }));
  }, [history]);

  const handleAddTagToItem = async (itemId: string, tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;

    const item = history.find((h) => h.id === itemId);
    if (!item) return;

    const currentTags = item.tags || [];
    if (currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setNewTagInput('');
      setEditingTagsItemId(null);
      return;
    }

    const updatedTags = [...currentTags, trimmed];
    if (onUpdateItem) {
      await onUpdateItem(itemId, { tags: updatedTags });
    } else {
      await updateConsultationHistoryItem(itemId, { tags: updatedTags });
    }
    setNewTagInput('');
    setEditingTagsItemId(null);
  };

  const handleRemoveTagFromItem = async (itemId: string, tagToRemove: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item = history.find((h) => h.id === itemId);
    if (!item) return;

    const updatedTags = (item.tags || []).filter(
      (t) => t.toLowerCase() !== tagToRemove.toLowerCase()
    );
    if (onUpdateItem) {
      await onUpdateItem(itemId, { tags: updatedTags });
    } else {
      await updateConsultationHistoryItem(itemId, { tags: updatedTags });
    }
  };

  const filteredHistory = useMemo(() => {
    let result = history;

    // 1. Filtrado por categoría / etiqueta seleccionada
    if (selectedTag) {
      const normSelected = selectedTag
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      result = result.filter((item) => {
        // Coincidencia en etiquetas personalizadas
        const hasTagMatch = (item.tags || []).some((t) =>
          t
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') === normSelected
        );
        if (hasTagMatch) return true;

        // Coincidencia complementaria en cuerpos normativos asociados o pregunta
        const hasDocMatch = (item.documentNames || []).some((d) =>
          d
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes(normSelected)
        );
        return hasDocMatch;
      });
    }

    // 2. Filtrado por palabras clave en pregunta o respuesta
    const rawQuery = searchQuery.trim();
    if (!rawQuery) return result;

    // Normalización sin acentos y en minúsculas para búsqueda tolerante y precisa
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const terms = normalize(rawQuery).split(/\s+/).filter(Boolean);

    return result.filter((item) => {
      const q = normalize(item.question || '');
      const a = normalize(item.response?.directAnswer || '');
      const keyPoints = (item.response?.keyPointsSummary || []).map(normalize).join(' ');
      const docs = (item.documentNames || []).map(normalize).join(' ');
      const caseApp = normalize(item.response?.caseApplication || '');
      const contra = normalize(item.response?.contradictions || '');
      const obs = normalize(item.response?.observations || '');
      const tagsText = (item.tags || []).map(normalize).join(' ');

      const citationsText = (item.response?.citationsByDocument || [])
        .flatMap((g) => [
          normalize(g.documentName),
          ...g.citations.map((c) => `${normalize(c.articleOrNumeral)} ${normalize(c.literalQuote)}`),
        ])
        .join(' ');

      // Contenido de búsqueda ponderado en pregunta y respuesta almacenada
      const combinedText = `${q} ${a} ${keyPoints} ${docs} ${caseApp} ${contra} ${obs} ${tagsText} ${citationsText}`;

      // Comprobar que todas las palabras clave buscadas estén presentes
      return terms.every((term) => combinedText.includes(term));
    });
  }, [history, searchQuery, selectedTag]);

  const handleDownloadPDF = async (item: ConsultationHistoryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setGeneratingPdfId(item.id);
      await generateConsultationPDF(item);
      setDownloadSuccessId(item.id);
      setTimeout(() => setDownloadSuccessId(null), 2500);
    } catch (err) {
      console.error('Error al generar reporte PDF con jsPDF:', err);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleDownloadSummaryPDF = async (item: ConsultationHistoryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setGeneratingSummaryPdfId(item.id);
      await downloadSummaryPDF({
        question: item.question,
        keyPoints: item.response.keyPointsSummary && item.response.keyPointsSummary.length > 0
          ? item.response.keyPointsSummary
          : [item.response.directAnswer],
        directAnswer: item.response.directAnswer,
        confidenceLabel: item.response.confidenceLabel,
        documentNames: item.documentNames,
        citations: item.response.citationsByDocument,
        timestamp: item.timestamp,
      });
      setDownloadSummarySuccessId({ id: item.id, type: 'pdf' });
      setTimeout(() => setDownloadSummarySuccessId(null), 2500);
    } catch (err) {
      console.error('Error al generar Ficha PDF de conclusiones:', err);
    } finally {
      setGeneratingSummaryPdfId(null);
    }
  };

  const handleDownloadSummaryTXT = (item: ConsultationHistoryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setGeneratingSummaryTxtId(item.id);
      downloadSummaryTXT({
        question: item.question,
        keyPoints: item.response.keyPointsSummary && item.response.keyPointsSummary.length > 0
          ? item.response.keyPointsSummary
          : [item.response.directAnswer],
        directAnswer: item.response.directAnswer,
        confidenceLabel: item.response.confidenceLabel,
        documentNames: item.documentNames,
        citations: item.response.citationsByDocument,
        timestamp: item.timestamp,
      });
      setDownloadSummarySuccessId({ id: item.id, type: 'txt' });
      setTimeout(() => setDownloadSummarySuccessId(null), 2500);
    } catch (err) {
      console.error('Error al generar TXT de conclusiones:', err);
    } finally {
      setGeneratingSummaryTxtId(null);
    }
  };

  const handleCopy = async (item: ConsultationHistoryItem) => {

    try {
      let text = `CONSULTA: ${item.question}\n\nRESPUESTA: ${item.response.directAnswer}\n\n`;
      if (item.response.citationsByDocument?.length) {
        text += 'FUNDAMENTO NORMATIVO:\n';
        item.response.citationsByDocument.forEach((group) => {
          group.citations.forEach((c) => {
            text += `[${c.documentName || group.documentName}] – ${c.articleOrNumeral} – Pág. ${c.pageNumber} del PDF\n`;
            text += `Texto literal: "${c.literalQuote}"\n\n`;
          });
        });
      }
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const formatDate = (isoString: string) => {
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

  /**
   * Exporta todas las consultas almacenadas en la base de datos a un archivo PDF formal estructurado,
   * manteniendo el orden, las referencias normativas con su artículo y página
   * en el PDF oficial, fechas exactas, dictámenes y conclusiones.
   */
  const handleExportPDF = async (onlyFiltered = false) => {
    try {
      setIsExportingPDF(true);
      let itemsToExport: ConsultationHistoryItem[] = [];

      const isFiltered = Boolean(searchQuery.trim() || selectedTag);
      if (onlyFiltered && isFiltered) {
        itemsToExport = filteredHistory;
      } else {
        // Consultar directamente la base de datos IndexedDB para garantizar la obtención de todas las consultas
        const dbItems = await getConsultationHistory();
        itemsToExport = dbItems && dbItems.length > 0 ? dbItems : history;
      }

      if (itemsToExport.length === 0) {
        return;
      }

      const filterConditions: string[] = [];
      if (selectedTag) filterConditions.push(`Categoría/Etiqueta: '${selectedTag}'`);
      if (searchQuery.trim()) filterConditions.push(`Búsqueda: '${searchQuery.trim()}'`);
      const filterQuery = onlyFiltered && filterConditions.length > 0 ? filterConditions.join(' | ') : undefined;

      const now = new Date();
      const dateSlug = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = onlyFiltered
        ? `Expediente_Consultas_Filtradas_${itemsToExport.length}_${dateSlug}.pdf`
        : `Expediente_Historial_Normativo_${itemsToExport.length}_${dateSlug}.pdf`;

      await exportConsultationHistoryPDF(itemsToExport, {
        fileName: filename,
        filterQuery,
      });

      setExportedFormat('pdf');
      setExportBannerMsg(
        `Se exportó exitosamente el expediente en PDF (${itemsToExport.length} consulta${itemsToExport.length > 1 ? 's' : ''} estructuradas con citas normativas y fechas).`
      );
      setTimeout(() => setExportedFormat(null), 3500);
      setTimeout(() => setExportBannerMsg(null), 6000);
    } catch (err) {
      console.error('Error al exportar consultas a PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  /**
   * Exporta todas las consultas almacenadas en la base de datos a un archivo CSV estructurado
   * para llevar un registro externo y trazabilidad de revisiones normativas.
   */
  const handleExportCSV = async (onlyFiltered = false) => {
    try {
      setIsExportingCSV(true);
      let itemsToExport: ConsultationHistoryItem[] = [];

      const isFiltered = Boolean(searchQuery.trim() || selectedTag);
      if (onlyFiltered && isFiltered) {
        itemsToExport = filteredHistory;
      } else {
        // Consultar directamente la base de datos IndexedDB para garantizar la obtención de todas las consultas
        const dbItems = await getConsultationHistory();
        itemsToExport = dbItems && dbItems.length > 0 ? dbItems : history;
      }

      if (itemsToExport.length === 0) {
        return;
      }

      const filename = onlyFiltered
        ? `Registro_Revisiones_Normativas_Filtradas_${itemsToExport.length}.csv`
        : undefined;

      exportConsultationHistoryCSV(itemsToExport, filename);
      setExportedFormat('csv');
      setExportBannerMsg(
        `Se exportaron exitosamente ${itemsToExport.length} consulta${itemsToExport.length > 1 ? 's' : ''} a CSV para tu registro externo de revisiones normativas.`
      );
      setTimeout(() => setExportedFormat(null), 3500);
      setTimeout(() => setExportBannerMsg(null), 6000);
    } catch (err) {
      console.error('Error al exportar consultas a CSV:', err);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    if (format === 'pdf') {
      handleExportPDF(false);
      return;
    }
    if (format === 'csv') {
      handleExportCSV(false);
      return;
    }
    if (history.length === 0) return;
    try {
      exportConsultationHistoryJSON(history);
      setExportedFormat('json');
      setExportBannerMsg(
        `Respaldo JSON descargado con éxito (${history.length} consulta${history.length > 1 ? 's' : ''}). Incluye estructura completa y citas.`
      );
      setTimeout(() => setExportedFormat(null), 3000);
      setTimeout(() => setExportBannerMsg(null), 5500);
    } catch (err) {
      console.error('Error al exportar respaldo de historial:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top search & management bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900">Historial de Consultas</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-mono border border-stone-200">
                {searchQuery.trim()
                  ? `${filteredHistory.length} de ${history.length} consultas`
                  : `${history.length} registradas`}
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Filtra instantáneamente por palabras clave presentes en la pregunta o en la respuesta almacenada
            </p>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {/* Botón Principal: Exportar todas las consultas a PDF Estructurado */}
              <button
                type="button"
                onClick={() => handleExportPDF(false)}
                disabled={isExportingPDF}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition-all active:scale-95 disabled:opacity-50 ${
                  exportedFormat === 'pdf'
                    ? 'bg-rose-700 text-white'
                    : 'bg-stone-900 hover:bg-stone-800 text-white'
                }`}
                title="Exportar todo el historial de consultas a un archivo PDF formal estructurado con referencias normativas y fechas"
              >
                {isExportingPDF ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : exportedFormat === 'pdf' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>{isExportingPDF ? 'Exportando PDF...' : exportedFormat === 'pdf' ? '¡PDF Exportado!' : 'Exportar a PDF'}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-stone-700 text-[10px] font-mono text-stone-200">
                  {history.length}
                </span>
              </button>

              {/* Botón Destacado: Exportar todas las consultas a CSV */}
              <button
                type="button"
                onClick={() => handleExportCSV(false)}
                disabled={isExportingCSV}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition-all active:scale-95 disabled:opacity-50 ${
                  exportedFormat === 'csv'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                }`}
                title="Exportar todas las consultas almacenadas en la base de datos a un archivo CSV estructurado para Excel"
              >
                {isExportingCSV ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : exportedFormat === 'csv' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-100" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>{isExportingCSV ? 'Exportando CSV...' : exportedFormat === 'csv' ? '¡CSV Exportado!' : 'Exportar a CSV'}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-800 text-[10px] font-mono">
                  {history.length}
                </span>
              </button>

              {/* Download backup buttons */}
              <div className="flex items-center bg-stone-100/90 p-1 rounded-lg border border-stone-200">
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all active:scale-95 ${
                    exportedFormat === 'json'
                      ? 'bg-stone-800 text-white shadow-2xs'
                      : 'bg-white text-stone-700 hover:text-stone-900 hover:bg-stone-50 border border-stone-200 shadow-2xs'
                  }`}
                  title="Descargar archivo JSON con el respaldo completo de todas las consultas guardadas"
                >
                  {exportedFormat === 'json' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>¡JSON!</span>
                    </>
                  ) : (
                    <>
                      <FileJson className="w-3.5 h-3.5 text-amber-600" />
                      <span>JSON</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('¿Deseas vaciar todo el historial de consultas?')) {
                    onClearHistory();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[36px]"
                title="Vaciar historial local"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            </div>
          )}
        </div>

        {/* Barra de Búsqueda Instantánea en la parte superior */}
        {history.length > 0 && (
          <div className="pt-2 border-t border-stone-100 space-y-2">
            <div className="relative flex items-center">
              <Search
                className={`w-4 h-4 absolute left-3.5 transition-colors pointer-events-none ${
                  searchQuery.trim() ? 'text-amber-600' : 'text-stone-400'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar instantáneamente por palabras clave en pregunta o respuesta (ej. multas, anticipo, fiscalización, recepción)..."
                className="w-full pl-10 pr-32 py-2.5 text-xs bg-stone-50/80 hover:bg-stone-50 focus:bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-900 shadow-2xs transition-all"
                autoComplete="off"
              />
              {searchQuery && (
                <div className="absolute right-2.5 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md font-mono">
                    {filteredHistory.length} {filteredHistory.length === 1 ? 'coincidencia' : 'coincidencias'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-md transition-colors"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Chips de filtro rápido por palabras clave frecuentes */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-stone-400 text-[10px] font-medium flex items-center gap-1">
                <Filter className="w-3 h-3 text-stone-400" />
                <span>Palabras clave frecuentes:</span>
              </span>
              {[
                'Anticipo',
                'Fiscalización',
                'Garantías',
                'Multas',
                'Recepción de obra',
                'Contrato complementario',
                'Planillas',
                'NEC',
              ].map((term) => {
                const isActive = searchQuery.toLowerCase().includes(term.toLowerCase());
                return (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSearchQuery(isActive ? '' : term)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                      isActive
                        ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                    }`}
                  >
                    {term}
                  </button>
                );
              })}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[10px] text-amber-700 hover:text-amber-900 underline underline-offset-2 ml-1 font-semibold"
                >
                  Restablecer búsqueda
                </button>
              )}
            </div>

            {/* Filtros por Categorías y Etiquetas Personalizadas */}
            <div className="pt-2.5 border-t border-stone-100 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                  <Tags className="w-3.5 h-3.5 text-amber-600" />
                  <span>Filtrar por Categoría / Etiqueta:</span>
                </div>
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="text-[10px] font-semibold text-amber-900 hover:text-amber-950 flex items-center gap-1 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md border border-amber-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    <span>Quitar filtro de etiqueta ({selectedTag})</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Botón Todas */}
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedTag === null
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  Todas ({history.length})
                </button>

                {/* Etiquetas asignadas a consultas en el historial */}
                {allUniqueTags.map(({ tag, count }) => {
                  const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(isSelected ? null : tag)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-2xs ring-2 ring-amber-600 ring-offset-1'
                          : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                      }`}
                      title={`Filtrar consultas etiquetadas como '${tag}'`}
                    >
                      <Tag className={`w-3 h-3 ${isSelected ? 'text-amber-100' : 'text-amber-700'}`} />
                      <span>{tag}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-amber-700 text-white' : 'bg-amber-200/80 text-amber-950'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                {/* Sugerencias de categorías estándar que aún no están asignadas */}
                {PRESET_CATEGORIES.filter(
                  (p) => !allUniqueTags.some((u) => u.tag.toLowerCase() === p.toLowerCase())
                ).map((preset) => {
                  const isSelected = selectedTag?.toLowerCase() === preset.toLowerCase();
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSelectedTag(isSelected ? null : preset)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                        isSelected
                          ? 'bg-stone-800 text-white shadow-2xs'
                          : 'bg-stone-50 text-stone-500 border border-stone-200 hover:bg-stone-100 hover:text-stone-800'
                      }`}
                      title={`Filtrar consultas relacionadas con '${preset}'`}
                    >
                      <span>{preset}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backup Download Success Banner */}
      {exportBannerMsg && (
        <div className="flex items-center justify-between gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{exportBannerMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportBannerMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-semibold px-1.5 py-0.5 rounded hover:bg-emerald-100 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tarjeta de Registro Externo y Expediente en PDF / CSV */}
      {history.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-stone-50 via-teal-50/30 to-emerald-50/60 border border-stone-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-5 h-5 text-rose-400" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Expediente Técnico y Exportación Estructurada (PDF / CSV)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-800 font-mono">
                  {history.length} {history.length === 1 ? 'consulta' : 'consultas'} almacenadas
                </span>
              </div>
              <p className="text-[11px] text-stone-600 max-w-2xl leading-relaxed">
                Exporta tu historial completo a un <strong>archivo PDF formal y estructurado</strong> (con foliado, referencias normativas exactas a artículos y páginas del PDF oficial, índice cronológico y fechas) o a una tabla <strong>CSV</strong> compatible con Microsoft Excel y Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap self-end md:self-auto">
            {(searchQuery.trim() || selectedTag) && filteredHistory.length !== history.length && (
              <>
                <button
                  type="button"
                  onClick={() => handleExportPDF(true)}
                  disabled={isExportingPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg shadow-2xs transition-colors"
                  title="Exportar únicamente las consultas que coinciden con los filtros actuales a PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>Filtradas a PDF ({filteredHistory.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCSV(true)}
                  disabled={isExportingCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg shadow-2xs transition-colors"
                  title="Exportar únicamente las consultas que coinciden con los filtros actuales a CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Filtradas a CSV ({filteredHistory.length})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleExportPDF(false)}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-2xs hover:shadow-xs transition-all active:scale-95 disabled:opacity-50"
              title="Descargar expediente PDF formal con todas las consultas, citas normativas y fechas"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : exportedFormat === 'pdf' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-rose-300" />
              )}
              <span>{isExportingPDF ? 'Generando PDF...' : exportedFormat === 'pdf' ? '¡PDF Descargado!' : 'Exportar a PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportCSV(false)}
              disabled={isExportingCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs hover:shadow-xs transition-all active:scale-95 disabled:opacity-50"
              title="Descargar archivo CSV con todas las consultas almacenadas en la base de datos"
            >
              {isExportingCSV ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : exportedFormat === 'csv' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>{isExportingCSV ? 'Generando CSV...' : exportedFormat === 'csv' ? '¡Descarga Completa!' : 'Exportar a CSV'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {history.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-stone-300">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800 mb-1">Sin consultas registradas</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Las consultas que realices en el Consultor Normativo se guardarán automáticamente aquí para tu referencia.
          </p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-xl border border-stone-200 space-y-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            {selectedTag ? <Tag className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 mb-1">
              Sin coincidencias {selectedTag ? `para la categoría "${selectedTag}"` : ''}{' '}
              {searchQuery.trim() ? `con búsqueda "${searchQuery.trim()}"` : ''}
            </h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              No se encontraron consultas registradas que coincidan con los criterios seleccionados. Puedes cambiar la categoría o limpiar los filtros.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {selectedTag && (
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300"
              >
                <X className="w-3.5 h-3.5" />
                <span>Quitar filtro "{selectedTag}"</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTag(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ver todas las consultas ({history.length})</span>
            </button>
          </div>
        </div>
      ) : (
        /* History Items List */
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* Item Summary Header */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.timestamp)}
                      </span>
                      <span className="text-[11px] text-stone-300">·</span>
                      <span className="text-[11px] text-stone-500">
                        {item.documentNames.join(', ') || 'Normativa consultada'}
                      </span>
                      {item.response.keyPointsSummary && item.response.keyPointsSummary.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                          <span>{item.response.keyPointsSummary.length} Conclusiones</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-stone-900 leading-snug">
                      <HighlightText text={item.question} query={searchQuery} />
                    </h3>

                    {!isExpanded && (
                      <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                        <HighlightText text={item.response.directAnswer} query={searchQuery} />
                      </p>
                    )}

                    {searchQuery.trim() && (
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        {item.question.toLowerCase().includes(searchQuery.trim().toLowerCase()) && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            En pregunta
                          </span>
                        )}
                        {item.response.directAnswer.toLowerCase().includes(searchQuery.trim().toLowerCase()) && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            En respuesta
                          </span>
                        )}
                      </div>
                    )}

                    {/* Etiquetas personalizadas del ítem */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                      {(item.tags || []).map((tag) => {
                        const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
                        return (
                          <span
                            key={tag}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100'
                            }`}
                          >
                            <Tag className={`w-2.5 h-2.5 ${isSelected ? 'text-amber-100' : 'text-amber-700'}`} />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTag(isSelected ? null : tag);
                              }}
                              className="hover:underline cursor-pointer"
                              title={`Filtrar consultas por la etiqueta '${tag}'`}
                            >
                              {tag}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveTagFromItem(item.id, tag, e)}
                              className={`p-0.5 rounded transition-colors ml-0.5 ${
                                isSelected
                                  ? 'text-amber-100 hover:text-white hover:bg-amber-700'
                                  : 'text-amber-700/60 hover:text-red-600 hover:bg-amber-200/60'
                              }`}
                              title={`Quitar etiqueta '${tag}'`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}

                      {/* Editor inline de etiquetas */}
                      {editingTagsItemId === item.id ? (
                        <div
                          className="inline-flex items-center gap-1.5 p-1.5 bg-stone-50 border border-stone-300 rounded-lg shadow-2xs animate-in fade-in duration-150 flex-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative flex items-center">
                            <Tag className="w-3 h-3 text-stone-400 absolute left-2 pointer-events-none" />
                            <input
                              type="text"
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddTagToItem(item.id, newTagInput);
                                } else if (e.key === 'Escape') {
                                  setEditingTagsItemId(null);
                                  setNewTagInput('');
                                }
                              }}
                              placeholder="Nueva etiqueta (ej. NEC, LOSNCP, Contratación)..."
                              className="pl-6 pr-2 py-1 text-[11px] bg-white border border-stone-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-stone-900 w-52"
                              autoFocus
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddTagToItem(item.id, newTagInput)}
                            disabled={!newTagInput.trim()}
                            className="px-2 py-1 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded-md transition-colors shadow-2xs"
                          >
                            Añadir
                          </button>

                          {/* Chips de sugerencias rápidas */}
                          <div className="flex items-center gap-1 flex-wrap pl-1 border-l border-stone-200">
                            {PRESET_CATEGORIES.slice(0, 5).map((preset) => {
                              const alreadyHas = (item.tags || []).some((t) => t.toLowerCase() === preset.toLowerCase());
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => handleAddTagToItem(item.id, preset)}
                                  disabled={alreadyHas}
                                  className={`px-1.5 py-0.5 text-[9px] rounded font-medium transition-all ${
                                    alreadyHas
                                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                      : 'bg-white text-stone-700 hover:bg-amber-100 hover:text-amber-900 border border-stone-200'
                                  }`}
                                  title={alreadyHas ? 'Etiqueta ya asignada' : `Añadir etiqueta '${preset}'`}
                                >
                                  +{preset}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagsItemId(null);
                              setNewTagInput('');
                            }}
                            className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                            title="Cerrar editor"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTagsItemId(item.id);
                            setNewTagInput('');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-dashed border-stone-300 transition-colors"
                          title="Añadir una etiqueta personalizada a esta consulta"
                        >
                          <Plus className="w-2.5 h-2.5 text-stone-400" />
                          <span>{(item.tags && item.tags.length > 0) ? 'Etiqueta' : '+ Añadir etiqueta'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                    {/* Descargar Ficha PDF de Conclusiones de Obra */}
                    <button
                      type="button"
                      onClick={(e) => handleDownloadSummaryPDF(item, e)}
                      disabled={generatingSummaryPdfId === item.id}
                      className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${
                        downloadSummarySuccessId?.id === item.id && downloadSummarySuccessId.type === 'pdf'
                          ? 'text-amber-800 bg-amber-100 border border-amber-300'
                          : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50'
                      }`}
                      title="Descargar Ficha de Conclusiones de Obra (PDF)"
                    >
                      {generatingSummaryPdfId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                      ) : downloadSummarySuccessId?.id === item.id && downloadSummarySuccessId.type === 'pdf' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Descargar TXT de Conclusiones */}
                    <button
                      type="button"
                      onClick={(e) => handleDownloadSummaryTXT(item, e)}
                      className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${
                        downloadSummarySuccessId?.id === item.id && downloadSummarySuccessId.type === 'txt'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-300'
                          : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                      }`}
                      title="Descargar conclusiones en formato Texto Plano (.txt) para Libro de Obra"
                    >
                      {downloadSummarySuccessId?.id === item.id && downloadSummarySuccessId.type === 'txt' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-stone-600" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownloadPDF(item, e)}
                      disabled={generatingPdfId === item.id}
                      className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${
                        downloadSuccessId === item.id
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                      }`}
                      title="Descargar reporte completo en PDF (jsPDF)"
                    >
                      {generatingPdfId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-stone-700" />
                      ) : downloadSuccessId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(item)}
                      className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                      title="Copiar respuesta"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectQuestion(item.question)}
                      className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                      title="Reutilizar consulta"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                      title="Eliminar del historial"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                      title={isExpanded ? 'Contraer' : 'Ver dictamen y citas completas'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Full Response View */}
                {isExpanded && (
                  <div className="border-t border-stone-100 bg-stone-50/50 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                          <FileText className="w-4 h-4 text-stone-700" />
                          <span>Reporte Técnico Formal con Citas Normativas (PDF)</span>
                        </div>
                        <p className="text-[11px] text-stone-500">
                          Generado con la librería jsPDF, foliado, citas literales exactas y estructura técnica.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadPDF(item)}
                        disabled={generatingPdfId === item.id}
                        className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors shadow-2xs disabled:opacity-50 min-h-[40px] shrink-0"
                      >
                        {generatingPdfId === item.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generando PDF...</span>
                          </>
                        ) : downloadSuccessId === item.id ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>PDF Descargado</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Descargar Reporte PDF</span>
                          </>
                        )}
                      </button>
                    </div>

                    <ResponseCard
                      response={item.response}
                      question={item.question}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Global Personal Backup Card */}
      {history.length > 0 && (
        <div className="p-4 bg-stone-50/90 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-stone-700" />
              <h4 className="text-xs font-bold text-stone-900">Copia de Seguridad y Respaldo Personal</h4>
            </div>
            <p className="text-[11px] text-stone-600 max-w-xl leading-relaxed">
              Exporta y guarda en tu equipo local todas tus {history.length} consultas registradas. Elige <strong>PDF</strong> para un expediente técnico foliado con citas y fechas, <strong>JSON</strong> para un respaldo íntegro con metadatos completos, o <strong>CSV</strong> (con codificación UTF-8 BOM) para Microsoft Excel y Google Sheets.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 rounded-lg border border-stone-300 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              title="Descargar expediente estructurado en PDF con todas las consultas y citas"
            >
              {isExportingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin text-stone-700" />
              ) : (
                <FileText className="w-4 h-4 text-rose-600" />
              )}
              <span>Descargar PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 rounded-lg border border-stone-300 shadow-2xs transition-all active:scale-95"
            >
              <FileJson className="w-4 h-4 text-amber-600" />
              <span>Descargar JSON</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 rounded-lg border border-stone-300 shadow-2xs transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Descargar CSV</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
