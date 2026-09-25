import React, { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  BookOpen,
  Sparkles,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Plus,
  FileText,
  Briefcase,
  Layers,
  History,
  Check,
  Copy,
  Minimize2,
  Maximize2,
  X,
  HardHat,
  Bookmark,
} from 'lucide-react';
import {
  NormativeDocument,
  ConsultationResponse,
  ConsultationHistoryItem,
  ConsultationMode,
  NormativeBookmark,
} from '../types/normative';
import { VoiceDictationButton } from './VoiceDictationButton';
import { VoiceDictationModal } from './VoiceDictationModal';
import { ResponseCard } from './ResponseCard';
import { QuickAccessPanel } from './QuickAccessPanel';
import { FREQUENT_QUESTIONS_DATA } from '../data/frequentQuestions';
import { useBookmarks } from '../hooks/useBookmarks';
import { BookmarksModal } from './BookmarksModal';
import { AddBookmarkModal } from './AddBookmarkModal';

interface ConsultationViewProps {
  documents: NormativeDocument[];
  onToggleActiveDoc: (id: string) => void;
  onConsultationCompleted: (item: ConsultationHistoryItem) => void;
  onNavigateToDocs: () => void;
  initialQuestion?: string;
  isReadingMode?: boolean;
  onToggleReadingMode?: () => void;
  history?: ConsultationHistoryItem[];
}


export const ConsultationView: React.FC<ConsultationViewProps> = ({
  documents,
  onToggleActiveDoc,
  onConsultationCompleted,
  onNavigateToDocs,
  initialQuestion = '',
  isReadingMode: isReadingModeProp,
  onToggleReadingMode,
  history = [],
}) => {
  const [internalReadingMode, setInternalReadingMode] = useState(false);
  const isReading = isReadingModeProp !== undefined ? isReadingModeProp : internalReadingMode;

  const toggleReadingMode = () => {
    if (onToggleReadingMode) {
      onToggleReadingMode();
    } else {
      setInternalReadingMode((prev) => !prev);
    }
  };

  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');

  const [question, setQuestion] = useState(initialQuestion);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [mode, setMode] = useState<ConsultationMode>('rapida');
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'consulta' | 'busquedaArticulo'>('consulta');

  // Direct article search states
  const [directNorma, setDirectNorma] = useState('');
  const [directArticulo, setDirectArticulo] = useState('');
  const [directResult, setDirectResult] = useState<any>(null);
  const [isDirectSearching, setIsDirectSearching] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);

  // Hook y estados de Marcadores de Proyectos
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

  const [isBookmarksModalOpen, setIsBookmarksModalOpen] = useState(false);
  const [isDirectAddBookmarkOpen, setIsDirectAddBookmarkOpen] = useState(false);
  const [directEditingBookmark, setDirectEditingBookmark] = useState<NormativeBookmark | null>(null);
  const [directBookmarkTarget, setDirectBookmarkTarget] = useState<any | null>(null);
  const [consultationBookmarkToast, setConsultationBookmarkToast] = useState<string | null>(null);

  const handleOpenDirectBookmark = () => {
    if (!directResult) return;
    const existing = getBookmark(directResult.norma, directResult.articulo);
    if (existing) {
      setDirectEditingBookmark(existing);
      setDirectBookmarkTarget({
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
      setDirectEditingBookmark(null);
      setDirectBookmarkTarget({
        documentName: directResult.norma,
        category: 'Búsqueda Directa',
        articleOrNumeral: directResult.articulo,
        pageNumber: directResult.pagina || 'Pág. s/n',
        excerpt: directResult.textoEncontrado || directResult.interpretacion || '',
        projectName: projects.length > 0 ? projects[0] : 'General',
        notes: '',
      });
    }
    setIsDirectAddBookmarkOpen(true);
  };

  const handleSaveDirectBookmark = async (data: {
    projectName: string;
    notes: string;
    tags: string[];
    documentName?: string;
    category?: string;
    articleOrNumeral?: string;
    pageNumber?: string;
    excerpt?: string;
  }) => {
    if (!directBookmarkTarget) return;
    try {
      const finalDocName = data.documentName || directBookmarkTarget.documentName;
      const finalCategory = data.category || directBookmarkTarget.category;
      const finalArticle = data.articleOrNumeral || directBookmarkTarget.articleOrNumeral;
      const finalPage = data.pageNumber || directBookmarkTarget.pageNumber;
      const finalExcerpt = data.excerpt || directBookmarkTarget.excerpt;

      if (directEditingBookmark) {
        await updateBookmarkItem(directEditingBookmark.id, {
          documentName: finalDocName,
          category: finalCategory,
          articleOrNumeral: finalArticle,
          pageNumber: finalPage,
          excerpt: finalExcerpt,
          projectName: data.projectName,
          notes: data.notes,
          tags: data.tags,
        });
        setConsultationBookmarkToast(`¡Marcador actualizado para el proyecto "${data.projectName}"!`);
      } else {
        await addBookmark({
          documentName: finalDocName,
          category: finalCategory,
          articleOrNumeral: finalArticle,
          pageNumber: finalPage,
          excerpt: finalExcerpt,
          questionContext: `Búsqueda directa: ${finalDocName} ${finalArticle}`,
          projectName: data.projectName,
          notes: data.notes,
          tags: data.tags,
        });
        setConsultationBookmarkToast(`¡Artículo guardado en marcadores para el proyecto "${data.projectName}"!`);
      }
      setTimeout(() => setConsultationBookmarkToast(null), 3500);
    } catch (err) {
      console.error('Error guardando marcador:', err);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<ConsultationResponse | null>(null);
  const [lastAskedQuestion, setLastAskedQuestion] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeDocs = documents.filter((d) => d.isActive);

  // Keyboard shortcut: Escape exits reading mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isReading) {
        toggleReadingMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReading]);

  const handleVoiceTranscript = (text: string) => {
    setQuestion((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleUpdateKeyPoints = (newPoints: string[]) => {
    if (!currentResponse) return;
    const updated: ConsultationResponse = {
      ...currentResponse,
      keyPointsSummary: newPoints,
    };
    setCurrentResponse(updated);
  };

  const handleConsultar = async (queryText?: string) => {
    const textToQuery = (queryText || question).trim();
    if (!textToQuery) return;

    if (activeDocs.length === 0) {
      setErrorMessage('No existen documentos normativos habilitados para realizar consultas. Carga o activa al menos un documento.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLastAskedQuestion(textToQuery);

    try {
      const response = await fetch('/api/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToQuery,
          mode,
          isHistorical: includeHistorical,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor (${response.status})`);
      }

      const result: ConsultationResponse = await response.json();
      setCurrentResponse(result);

      // Save to local history (IndexedDB)
      const historyItem: ConsultationHistoryItem = {
        id: 'hist_' + Date.now(),
        question: textToQuery,
        response: result,
        timestamp: new Date().toISOString(),
        documentNames: activeDocs.map((d) => d.name),
        mode,
      };
      onConsultationCompleted(historyItem);
    } catch (err: any) {
      console.error('Error during consultation:', err);
      setErrorMessage(err.message || 'Ocurrió un error al consultar con Gemini File Search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectArticleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directArticulo.trim()) return;

    setIsDirectSearching(true);
    setDirectResult(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/consultar-articulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          normaId: directNorma || activeDocs[0]?.id,
          articulo: directArticulo.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al buscar artículo.');
      setDirectResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al consultar artículo.');
    } finally {
      setIsDirectSearching(false);
    }
  };

  const handleCopyDirectResult = async () => {
    if (!directResult) return;
    try {
      const textToCopy = `CONSULTOR NORMATIVO ECUADOR - BÚSQUEDA DE ARTÍCULO\n` +
        `CUERPO NORMATIVO: ${directResult.norma}\n` +
        `ARTÍCULO: ${directResult.articulo}\n` +
        `UBICACIÓN: ${directResult.pagina}\n\n` +
        `CONTENIDO:\n${directResult.textoEncontrado || directResult.interpretacion}\n`;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedDirect(true);
      setTimeout(() => setCopiedDirect(false), 2500);
    } catch (err) {
      console.error('Error al copiar artículo:', err);
    }
  };

  // ==========================================
  // RENDER: MODO LECTURA (DISTRACTION-FREE)
  // Oculta la barra lateral y elementos de navegación
  // Maximiza el área de visualización del texto de la respuesta normativa
  // ==========================================
  if (isReading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        {/* Barra superior de Modo Lectura */}
        <div className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between gap-3 flex-wrap sticky top-3 z-30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Modo Lectura
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Área Maximizada
                </span>
              </div>
              <p className="text-[11px] text-stone-500 truncate max-w-[200px] sm:max-w-md">
                {lastAskedQuestion || question || (directResult ? `${directResult.norma} - ${directResult.articulo}` : 'Lectura sin distracciones de normativa')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Control de tamaño tipográfico para lectura cómoda */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
              <span className="text-[11px] text-stone-500 px-1 font-medium hidden sm:inline">Texto:</span>
              <button
                type="button"
                onClick={() => setFontSize('normal')}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  fontSize === 'normal'
                    ? 'bg-white text-stone-900 font-bold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Tamaño de texto normal"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('large')}
                className={`px-2 py-1 rounded-lg transition-colors font-medium ${
                  fontSize === 'large'
                    ? 'bg-white text-stone-900 font-bold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Tamaño de texto grande"
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => setFontSize('xlarge')}
                className={`px-2 py-1 rounded-lg transition-colors font-bold ${
                  fontSize === 'xlarge'
                    ? 'bg-white text-stone-900 font-bold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Tamaño de texto muy grande"
              >
                A++
              </button>
            </div>

            {/* Botón de Marcadores de Proyectos en Modo Lectura */}
            <button
              type="button"
              onClick={() => setIsBookmarksModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-950 hover:bg-amber-100 border border-amber-300 shadow-2xs transition-all min-h-[36px]"
              title="Ver fragmentos y citas normativas guardadas en marcadores de proyectos"
            >
              <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-700" />
              <span>Marcadores</span>
              {bookmarks.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-[10px] font-mono font-bold text-amber-950">
                  {bookmarks.length}
                </span>
              )}
            </button>

            {/* Botón para salir del Modo Lectura */}
            <button
              type="button"
              onClick={toggleReadingMode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all shadow-2xs min-h-[36px]"
              title="Salir del Modo Lectura y volver a la navegación normal (Tecla Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-stone-700" />
              <span>Salir del Modo Lectura</span>
              <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 bg-white border border-stone-300 rounded text-[10px] font-mono text-stone-600">
                Esc
              </kbd>
            </button>
          </div>
        </div>

        {/* Visualización maximizada del texto de respuesta normativa */}
        {currentResponse ? (
          <ResponseCard
            response={currentResponse}
            question={lastAskedQuestion || question}
            isReadingMode={true}
            onToggleReadingMode={toggleReadingMode}
            fontSize={fontSize}
            onUpdateKeyPoints={handleUpdateKeyPoints}
          />
        ) : directResult ? (
          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 gap-2 flex-wrap">
              <div>
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                  Búsqueda de Artículo Específico
                </span>
                <h2 className="text-base font-bold text-stone-900">
                  {directResult.norma} &mdash; {directResult.articulo}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-stone-100 border border-stone-200 text-stone-800 px-2.5 py-1 rounded-lg">
                  {directResult.pagina}
                </span>

                <button
                  type="button"
                  onClick={handleOpenDirectBookmark}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors border ${
                    isBookmarked(directResult.norma, directResult.articulo)
                      ? 'bg-amber-100 text-amber-950 border-amber-300 font-semibold'
                      : 'bg-white text-stone-700 hover:text-amber-950 border-stone-200 hover:bg-amber-50'
                  }`}
                  title="Guardar este artículo en marcadores de proyectos"
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      isBookmarked(directResult.norma, directResult.articulo)
                        ? 'fill-amber-500 text-amber-600'
                        : 'text-stone-400'
                    }`}
                  />
                  <span>
                    {isBookmarked(directResult.norma, directResult.articulo)
                      ? 'En Marcadores'
                      : 'Guardar Marcador'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDirectResult}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors border ${
                    copiedDirect
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-stone-700 hover:text-stone-950 border-stone-200 hover:bg-stone-50'
                  }`}
                  title="Copiar texto del artículo al portapapeles con un solo clic"
                >
                  {copiedDirect ? (
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
            <div className={`p-4 bg-stone-50/80 rounded-xl border border-stone-200/80 text-stone-900 whitespace-pre-wrap leading-relaxed ${
              fontSize === 'xlarge' ? 'text-lg leading-relaxed' : fontSize === 'large' ? 'text-base leading-relaxed' : 'text-sm leading-relaxed'
            }`}>
              {directResult.textoEncontrado || directResult.interpretacion}
            </div>
          </div>
        ) : (
          <div className="p-10 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
            <BookOpen className="w-12 h-12 text-stone-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-stone-900">Modo Lectura Activo</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                No hay una respuesta cargada en este momento. Puedes volver a la vista normal para escribir una consulta técnica o seleccionar una de las preguntas de fiscalización.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleReadingMode}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-all"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Volver a la vista de consulta</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: MODO NORMAL CON BARRA LATERAL
  // Barra lateral: Documentos activos + Consultas frecuentes
  // Área principal: Formulario de consulta + Respuesta
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Barra superior de herramientas y switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-stone-100 p-2 rounded-2xl">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-stone-200/60 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('consulta')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSubTab === 'consulta'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Consulta Normativa
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('busquedaArticulo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSubTab === 'busquedaArticulo'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Búsqueda de Artículo
            </button>
          </div>

          {activeSubTab === 'consulta' && (
            <div className="flex items-center gap-1 bg-stone-200/60 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('rapida')}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  mode === 'rapida' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Respuesta técnica directa y concisa"
              >
                Rápida
              </button>
              <button
                type="button"
                onClick={() => setMode('analisis')}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  mode === 'analisis' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Análisis normativo detallado con aplicación práctica"
              >
                Análisis
              </button>
              <button
                type="button"
                onClick={() => setMode('informe')}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  mode === 'informe' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Estructura formal de Informe Técnico para fiscalización"
              >
                Informe Técnico
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de Marcadores de Proyectos */}
          <button
            type="button"
            onClick={() => setIsBookmarksModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-950 hover:bg-amber-100 border border-amber-300 shadow-2xs transition-all hover:shadow-xs min-h-[38px] sm:min-h-0"
            title="Ver fragmentos y citas normativas guardadas en marcadores de proyectos"
          >
            <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-700" />
            <span>Marcadores</span>
            {bookmarks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-[10px] font-mono font-bold text-amber-950">
                {bookmarks.length}
              </span>
            )}
          </button>

          {/* BOTÓN MODO LECTURA EN CONSULTATIONVIEW */}
          <button
            type="button"
            onClick={toggleReadingMode}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-white text-stone-800 hover:text-stone-950 border border-stone-200 hover:border-stone-300 shadow-2xs transition-all hover:bg-stone-50 min-h-[38px] sm:min-h-0"
            title="Modo Lectura: oculta la barra lateral y la navegación para maximizar el área de visualización del texto normativo"
          >
            <BookOpen className="w-3.5 h-3.5 text-stone-700" />
            <span>Modo Lectura</span>
          </button>
        </div>
      </div>

      {/* Disposición con Barra Lateral y Área Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* BARRA LATERAL (SIDEBAR): Documentos Activos & Consultas Frecuentes */}
        <aside className="lg:col-span-4 space-y-5 order-2 lg:order-1">
          {/* Tarjeta de Documentos Normativos Activos */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Biblioteca Activa
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {activeDocs.length} de {documents.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onNavigateToDocs}
                className="text-xs font-medium text-stone-600 hover:text-stone-900 hover:underline flex items-center gap-0.5"
                title="Ver y cargar documentos normativos oficiales"
              >
                <span>Biblioteca</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeDocs.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Sin documentos activos para consultar.</span>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToDocs}
                  className="w-full text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors text-center"
                >
                  Habilitar documentos
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onToggleActiveDoc(doc.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                      doc.isActive
                        ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                        : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300'
                    }`}
                    title={doc.isActive ? 'Clic para desactivar de la consulta' : 'Clic para activar en la consulta'}
                  >
                    <span className="truncate font-medium">{doc.name}</span>
                    <span className="text-[10px] font-mono shrink-0 px-1 py-0.2 rounded bg-stone-800/40">
                      {doc.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tarjeta de Consultas Frecuentes en Obra Pública */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Consultas Rápidas
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                NEC / LOSNCP
              </span>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {FREQUENT_QUESTIONS_DATA.slice(0, 8).map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setQuestion(item.question);
                    if (item.suggestedMode) setMode(item.suggestedMode);
                    handleConsultar(item.question);
                  }}
                  disabled={activeDocs.length === 0 || isLoading}
                  className="w-full p-2.5 text-left bg-stone-50/70 hover:bg-stone-100 border border-stone-200/80 rounded-xl text-xs text-stone-800 transition-all disabled:opacity-50 flex flex-col gap-1 group"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-[10px] font-mono text-stone-400">
                      #{idx + 1}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      item.category === 'NEC'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-blue-100 text-blue-900'
                    }`}>
                      {item.category}
                    </span>
                  </div>
                  <span className="line-clamp-2 leading-relaxed text-[11px] font-medium group-hover:text-stone-950">
                    {item.question}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ÁREA PRINCIPAL: Formulario de consulta + Respuestas */}
        <section className="lg:col-span-8 space-y-6 order-1 lg:order-2">
          {/* Sub-tab 1: Consulta en Lenguaje Natural */}
          {activeSubTab === 'consulta' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="consultation-input" className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Pregunta en Lenguaje Natural
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                    title="Abrir asistente de dictado por voz para visitas a obra"
                  >
                    <HardHat className="w-3.5 h-3.5 text-amber-700" />
                    <span>Dictado en Obra</span>
                    <span className="hidden sm:inline text-[10px] text-amber-700 bg-amber-200/80 px-1.5 py-0.2 rounded font-mono">Voz</span>
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    id="consultation-input"
                    rows={3}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleConsultar();
                      }
                    }}
                    placeholder="Escribe tu consulta sobre normativa de construcción, contratación pública, fiscalización, garantías, anticipos o especificaciones técnicas..."
                    className="w-full p-4 pr-24 text-sm bg-stone-50 border border-stone-300 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white resize-none transition-all leading-relaxed"
                    disabled={isLoading}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-1">
                    <VoiceDictationButton
                      onTranscript={handleVoiceTranscript}
                      disabled={isLoading}
                      onOpenModal={() => setIsVoiceModalOpen(true)}
                      showExpandOption={true}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHistorical}
                    onChange={(e) => setIncludeHistorical(e.target.checked)}
                    className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4"
                  />
                  <span className="text-xs text-stone-600">
                    Incluir versiones históricas de la biblioteca
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleConsultar()}
                  disabled={isLoading || !question.trim() || activeDocs.length === 0}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Consultando File Search...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Consultar Normativa</span>
                    </>
                  )}
                </button>
              </div>

              {/* Accesos rápidos: consultas recientes, guardadas y estado de la biblioteca */}
              <QuickAccessPanel
                history={history}
                documents={documents}
                currentQuestion={question}
                currentMode={mode}
                onSelectQuestion={(selectedQ, selectedMode) => {
                  setQuestion(selectedQ);
                  if (selectedMode) setMode(selectedMode);
                }}
                onNavigateToDocs={onNavigateToDocs}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Sub-tab 2: Búsqueda de Artículo Específico */}
          {activeSubTab === 'busquedaArticulo' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
              <form onSubmit={handleDirectArticleSearch} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Cuerpo Normativo
                    </label>
                    <select
                      value={directNorma}
                      onChange={(e) => setDirectNorma(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 font-medium"
                    >
                      {activeDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.category})
                        </option>
                      ))}
                      {activeDocs.length === 0 && <option value="">Sin documentos activos</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Artículo o Numeral a Localizar
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={directArticulo}
                        onChange={(e) => setDirectArticulo(e.target.value)}
                        placeholder="Ej. Art. 42, Art. 74, Disposición Transitoria Primera"
                        className="w-full pl-3 pr-11 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900"
                        required
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <VoiceDictationButton
                          size="sm"
                          onTranscript={(text) => setDirectArticulo((prev) => (prev ? `${prev} ${text}` : text))}
                          disabled={isDirectSearching}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isDirectSearching || !directArticulo.trim() || activeDocs.length === 0}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 rounded-xl shadow-xs transition-colors flex items-center gap-2 min-h-[44px]"
                  >
                    {isDirectSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Buscando artículo...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Consultar Artículo</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Direct Article Result */}
              {directResult && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2 gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-900">
                      {directResult.norma} &mdash; {directResult.articulo}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono bg-stone-200 text-stone-800 px-2 py-0.5 rounded">
                        {directResult.pagina}
                      </span>

                      <button
                        type="button"
                        onClick={handleOpenDirectBookmark}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                          isBookmarked(directResult.norma, directResult.articulo)
                            ? 'bg-amber-100 text-amber-950 border-amber-300 font-semibold'
                            : 'bg-white text-stone-700 hover:text-amber-950 border-stone-200 hover:bg-amber-50'
                        }`}
                        title="Guardar este artículo en marcadores de proyectos"
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            isBookmarked(directResult.norma, directResult.articulo)
                              ? 'fill-amber-500 text-amber-600'
                              : 'text-stone-400'
                          }`}
                        />
                        <span>
                          {isBookmarked(directResult.norma, directResult.articulo)
                            ? 'En Marcadores'
                            : 'Guardar Marcador'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyDirectResult}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                          copiedDirect
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-white text-stone-700 hover:text-stone-950 border-stone-200 hover:bg-stone-100'
                        }`}
                        title="Copiar texto del artículo al portapapeles con un solo clic"
                      >
                        {copiedDirect ? (
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
                  <div className="text-xs text-stone-800 leading-relaxed font-sans bg-white p-3.5 rounded-lg border border-stone-200 whitespace-pre-wrap">
                    {directResult.textoEncontrado || directResult.interpretacion}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="w-24 h-4 bg-stone-200 rounded-md"></div>
                <div className="w-32 h-4 bg-stone-100 rounded-md"></div>
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-stone-200 rounded-md"></div>
                <div className="w-5/6 h-3 bg-stone-200 rounded-md"></div>
                <div className="w-4/6 h-3 bg-stone-200 rounded-md"></div>
              </div>
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <div className="w-36 h-3 bg-stone-200 rounded-md"></div>
                <div className="w-full h-12 bg-stone-100 rounded-xl"></div>
              </div>
            </div>
          )}

          {/* Consultation Response Card */}
          {currentResponse && !isLoading && (
            <ResponseCard
              response={currentResponse}
              question={lastAskedQuestion}
              isReadingMode={false}
              onToggleReadingMode={toggleReadingMode}
              fontSize={fontSize}
              onUpdateKeyPoints={handleUpdateKeyPoints}
            />
          )}
        </section>
      </div>

      {/* Modal de Dictado por Voz para Visitas a Obra */}
      <VoiceDictationModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        initialText={question}
        onInsertText={(text) => setQuestion(text)}
        onSubmitQuery={(text) => {
          setQuestion(text);
          handleConsultar(text);
        }}
      />

      {/* Modal / Drawer de Marcadores de Proyectos */}
      <BookmarksModal
        isOpen={isBookmarksModalOpen}
        onClose={() => setIsBookmarksModalOpen(false)}
        bookmarks={bookmarks}
        onDeleteBookmark={removeBookmark}
        onEditBookmark={(b) => {
          setDirectEditingBookmark(b);
          setDirectBookmarkTarget({
            id: b.id,
            documentName: b.documentName,
            category: b.category,
            articleOrNumeral: b.articleOrNumeral,
            pageNumber: b.pageNumber,
            excerpt: b.excerpt,
            projectName: b.projectName,
            notes: b.notes,
          });
          setIsBookmarksModalOpen(false);
          setIsDirectAddBookmarkOpen(true);
        }}
        onClearAllBookmarks={removeAllBookmarks}
      />

      {/* Modal para Agregar Marcador desde Búsqueda Directa */}
      <AddBookmarkModal
        isOpen={isDirectAddBookmarkOpen}
        onClose={() => setIsDirectAddBookmarkOpen(false)}
        onSave={handleSaveDirectBookmark}
        initialData={directBookmarkTarget || undefined}
        existingProjects={projects}
        isEditing={!!directEditingBookmark}
      />

      {/* Toast flotante de confirmación */}
      {consultationBookmarkToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-4 duration-200 border border-stone-800">
          <Bookmark className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
          <span>{consultationBookmarkToast}</span>
          <button
            type="button"
            onClick={() => setIsBookmarksModalOpen(true)}
            className="underline text-amber-300 hover:text-amber-200 font-bold ml-1"
          >
            Ver marcadores
          </button>
        </div>
      )}
    </div>
  );
};
