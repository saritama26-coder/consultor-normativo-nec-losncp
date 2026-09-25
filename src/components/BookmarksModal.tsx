import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  X,
  Search,
  Building2,
  Trash2,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  Download,
  Edit2,
  Folder,
  Tag,
  ExternalLink,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { NormativeBookmark } from '../types/normative';

interface BookmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: NormativeBookmark[];
  onDeleteBookmark: (id: string) => void;
  onEditBookmark: (bookmark: NormativeBookmark) => void;
  onClearAllBookmarks: () => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onDeleteBookmark,
  onEditBookmark,
  onClearAllBookmarks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('TODOS');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<'txt' | 'csv' | null>(null);

  // Projects list
  const projectsList = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => {
      if (b.projectName) set.add(b.projectName.trim());
    });
    return Array.from(set).sort();
  }, [bookmarks]);

  // Filtered bookmarks
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((b) => {
      // Filter by project
      if (selectedProject !== 'TODOS' && b.projectName !== selectedProject) {
        return false;
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inDoc = b.documentName.toLowerCase().includes(q);
        const inArt = b.articleOrNumeral.toLowerCase().includes(q);
        const inText = b.excerpt.toLowerCase().includes(q);
        const inNotes = (b.notes || '').toLowerCase().includes(q);
        const inProj = (b.projectName || '').toLowerCase().includes(q);
        return inDoc || inArt || inText || inNotes || inProj;
      }
      return true;
    });
  }, [bookmarks, selectedProject, searchQuery]);

  if (!isOpen) return null;

  const handleCopyCitation = async (b: NormativeBookmark) => {
    try {
      let text = `[${b.documentName}] – ${b.articleOrNumeral} – ${b.pageNumber}\n`;
      text += `Texto literal: "${b.excerpt.replace(/^["']|["']$/g, '')}"\n`;
      if (b.projectName) text += `Proyecto: ${b.projectName}\n`;
      if (b.notes) text += `Anotación: ${b.notes}\n`;

      await navigator.clipboard.writeText(text);
      setCopiedId(b.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error al copiar cita de marcador:', err);
    }
  };

  const handleExportTXT = () => {
    if (bookmarks.length === 0) return;
    const items = filteredBookmarks.length > 0 ? filteredBookmarks : bookmarks;

    let content = `========================================================================\n`;
    content += `CONSULTOR NORMATIVO ECUADOR - MARCADORES Y CITAS DE PROYECTO\n`;
    content += `Generado: ${new Date().toLocaleString('es-EC')}\n`;
    content += `Total de fragmentos: ${items.length}\n`;
    content += `========================================================================\n\n`;

    items.forEach((b, idx) => {
      content += `[MARCADOR #${idx + 1}]\n`;
      content += `PROYECTO: ${b.projectName || 'General'}\n`;
      content += `NORMATIVA: ${b.documentName} (${b.category})\n`;
      content += `ARTÍCULO / NUMERAL: ${b.articleOrNumeral}\n`;
      content += `UBICACIÓN: ${b.pageNumber}\n`;
      content += `TEXTO LITERAL:\n"${b.excerpt.replace(/^["']|["']$/g, '')}"\n`;
      if (b.notes) content += `ANOTACIONES: ${b.notes}\n`;
      if (b.tags && b.tags.length > 0) content += `ETIQUETAS: ${b.tags.join(', ')}\n`;
      content += `FECHA DE REGISTRO: ${b.createdAt}\n`;
      content += `------------------------------------------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Marcadores_Proyectos_Normativos_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess('txt');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleExportCSV = () => {
    if (bookmarks.length === 0) return;
    const items = filteredBookmarks.length > 0 ? filteredBookmarks : bookmarks;

    const headers = [
      'Proyecto',
      'Documento Normativo',
      'Categoría',
      'Artículo / Numeral',
      'Página PDF',
      'Fragmento Literal',
      'Anotaciones y Justificación',
      'Etiquetas',
      'Fecha Guardado',
    ];

    const escapeCell = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

    const rows = [headers.map(escapeCell).join(',')];

    items.forEach((b) => {
      rows.push(
        [
          escapeCell(b.projectName || 'General'),
          escapeCell(b.documentName),
          escapeCell(b.category),
          escapeCell(b.articleOrNumeral),
          escapeCell(b.pageNumber),
          escapeCell(b.excerpt.replace(/^["']|["']$/g, '')),
          escapeCell(b.notes || ''),
          escapeCell((b.tags || []).join('; ')),
          escapeCell(b.createdAt),
        ].join(',')
      );
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Marcadores_Proyectos_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess('csv');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-4xl w-full h-[90vh] max-h-[850px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shadow-2xs">
              <Bookmark className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Marcadores de Proyectos
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 font-bold">
                  {bookmarks.length} guardado{bookmarks.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Fragmentos normativos y citas específicas guardadas para referencia en obras y futuros proyectos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por artículo, fragmento de texto, nombre de obra o nota..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Export buttons */}
            {bookmarks.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors shadow-2xs"
                  title="Exportar marcadores a Microsoft Excel (.csv)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{downloadSuccess === 'csv' ? '¡CSV Listo!' : 'Excel (.csv)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportTXT}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-colors shadow-2xs"
                  title="Descargar dossier de citas en texto plano (.txt)"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  <span>{downloadSuccess === 'txt' ? '¡TXT Listo!' : 'Texto (.txt)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('¿Deseas eliminar todos los marcadores guardados?')) {
                      onClearAllBookmarks();
                    }
                  }}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Vaciar todos los marcadores"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Project Filter Pills */}
          {projectsList.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Building2 className="w-3 h-3" />
                <span>Proyecto:</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedProject('TODOS')}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                  selectedProject === 'TODOS'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                Todos ({bookmarks.length})
              </button>
              {projectsList.map((proj) => {
                const count = bookmarks.filter((b) => b.projectName === proj).length;
                return (
                  <button
                    key={proj}
                    type="button"
                    onClick={() => setSelectedProject(proj)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                      selectedProject === proj
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-stone-700 hover:bg-amber-50 border border-stone-200'
                    }`}
                  >
                    <span>{proj}</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded-full bg-black/10">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {bookmarks.length === 0 ? (
            <div className="text-center py-20 px-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
                <Bookmark className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">
                Aún no tienes marcadores guardados
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                Cuando realices una consulta y el asistente cite artículos específicos de la <strong>NEC</strong> o la <strong>LOSNCP</strong>, haz clic en el botón <strong>«Guardar Marcador»</strong> para conservar el fragmento legal y asociarlo a tus proyectos futuros.
              </p>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-xs text-stone-500">
                No se encontraron marcadores que coincidan con los filtros aplicados.
              </p>
            </div>
          ) : (
            filteredBookmarks.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Bookmark Card Header */}
                <div className="p-4 bg-stone-50/70 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-900">
                      [{b.documentName}]
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-200">
                      {b.articleOrNumeral}
                    </span>
                    <span className="text-[11px] font-mono text-stone-600 bg-stone-200 px-2 py-0.5 rounded">
                      {b.pageNumber}
                    </span>
                  </div>

                  {/* Project Tag Badge */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-1.5 shadow-2xs">
                      <Building2 className="w-3 h-3 text-amber-700" />
                      <span>{b.projectName || 'General'}</span>
                    </span>

                    {b.tags && b.tags.length > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                        {b.tags[0]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Excerpt Body */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="bg-stone-50/90 p-3.5 rounded-xl border border-stone-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Fragmento Literal de la Norma:
                    </span>
                    <blockquote className="text-xs sm:text-sm text-stone-800 italic leading-relaxed border-l-3 border-amber-500 pl-3">
                      "{b.excerpt.replace(/^["']|["']$/g, '')}"
                    </blockquote>
                  </div>

                  {/* Notes / Annotation */}
                  {b.notes && (
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 text-xs text-amber-950 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-[11px] text-amber-900 mb-0.5">
                          Anotación de Proyecto:
                        </span>
                        <p className="leading-relaxed text-amber-900/90">{b.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Question Context if available */}
                  {b.questionContext && (
                    <p className="text-[11px] text-stone-400 italic">
                      Consulta de origen: "{b.questionContext}"
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-4 py-2.5 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-stone-400 font-mono">
                    Guardado: {new Date(b.createdAt).toLocaleDateString('es-EC')}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyCitation(b)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        copiedId === b.id
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-white text-stone-700 hover:text-stone-900 border-stone-200 hover:bg-stone-50'
                      }`}
                      title="Copiar cita formal y fragmento al portapapeles"
                    >
                      {copiedId === b.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-500" />
                          <span>Copiar Cita</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditBookmark(b)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-stone-700 hover:text-stone-900 border border-stone-200 hover:bg-stone-50 transition-colors"
                      title="Editar asignación de proyecto y anotaciones"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteBookmark(b.id)}
                      className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar marcador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 shrink-0 flex items-center justify-between text-xs text-stone-500 px-5">
          <span>{filteredBookmarks.length} de {bookmarks.length} marcadores mostrados</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
