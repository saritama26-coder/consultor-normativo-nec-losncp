import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  X,
  FolderPlus,
  FileText,
  Tag,
  Check,
  Building2,
  Sparkles,
  Info,
} from 'lucide-react';
import { NormativeBookmark } from '../types/normative';

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    projectName: string;
    notes: string;
    tags: string[];
    documentName?: string;
    category?: string;
    articleOrNumeral?: string;
    pageNumber?: string;
    excerpt?: string;
  }) => void;
  initialData?: {
    documentName: string;
    category: string;
    articleOrNumeral: string;
    pageNumber: string;
    excerpt: string;
    projectName?: string;
    notes?: string;
  };
  availableCitations?: Array<{
    documentName: string;
    category: string;
    articleOrNumeral: string;
    pageNumber: string;
  }>;
  existingProjects?: string[];
  isEditing?: boolean;
}

export const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  availableCitations = [],
  existingProjects = [],
  isEditing = false,
}) => {
  const [documentName, setDocumentName] = useState('');
  const [category, setCategory] = useState('');
  const [articleOrNumeral, setArticleOrNumeral] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Obra / Fiscalización');
  const [showCitationFields, setShowCitationFields] = useState(false);

  useEffect(() => {
    if (isOpen && initialData) {
      setDocumentName(initialData.documentName || '');
      setCategory(initialData.category || 'General');
      setArticleOrNumeral(initialData.articleOrNumeral || '');
      setPageNumber(initialData.pageNumber || 'Pág.: s/n');
      setExcerpt(initialData.excerpt || '');
      setProjectName(initialData.projectName || '');
      setNotes(initialData.notes || '');
      setShowCitationFields(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen || !initialData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      documentName: documentName.trim() || initialData.documentName,
      category: category.trim() || initialData.category,
      articleOrNumeral: articleOrNumeral.trim() || initialData.articleOrNumeral,
      pageNumber: pageNumber.trim() || initialData.pageNumber,
      excerpt: excerpt.trim() || initialData.excerpt,
      projectName: projectName.trim() || 'General / Sin Asignar',
      notes: notes.trim(),
      tags: selectedTag ? [selectedTag] : [],
    });
    onClose();
  };

  const handleSelectPredefinedCitation = (c: {
    documentName: string;
    category: string;
    articleOrNumeral: string;
    pageNumber: string;
  }) => {
    setDocumentName(c.documentName);
    setCategory(c.category);
    setArticleOrNumeral(c.articleOrNumeral);
    setPageNumber(c.pageNumber);
  };

  const defaultProjectsSuggestions = [
    'Hospital Puyo',
    'Plan Maestro Agua Potable',
    'Puente Río Pastaza',
    'Fiscalización Obra Vial',
    'Licitación SERCOP 2026',
    'Edificio Administrativo GAD',
  ];

  const allSuggestions = Array.from(
    new Set([...existingProjects, ...defaultProjectsSuggestions])
  ).slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-2xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center">
              <Bookmark className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {isEditing ? 'Editar Marcador de Proyecto' : 'Guardar en Marcadores'}
              </h3>
              <p className="text-[11px] text-stone-400">
                Referencia rápida para futuros proyectos y contratos de obra
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Excerpt and Citation Box */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/90 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-stone-900">
                  [{documentName || initialData.documentName}]
                </span>
                <span className="text-stone-300">·</span>
                <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                  {articleOrNumeral || initialData.articleOrNumeral}
                </span>
                <span className="text-stone-300">·</span>
                <span className="text-[11px] font-mono text-stone-600 bg-stone-200 px-1.5 py-0.2 rounded">
                  {pageNumber || initialData.pageNumber}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowCitationFields((prev) => !prev)}
                className="text-[10px] font-medium text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                {showCitationFields ? 'Ocultar edición de cita' : 'Editar cita / texto'}
              </button>
            </div>

            {/* Quick selector if multiple citations exist from the response */}
            {availableCitations.length > 1 && (
              <div className="pt-1 border-t border-stone-200/60">
                <span className="text-[10px] text-stone-500 font-medium block mb-1">
                  Vincular a cita de la consulta:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {availableCitations.map((c, i) => {
                    const isSelected =
                      c.documentName === documentName && c.articleOrNumeral === articleOrNumeral;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectPredefinedCitation(c)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-amber-200 text-amber-950 border-amber-400 font-bold'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {c.documentName.split(' ')[0]} - {c.articleOrNumeral}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Editable fields when showCitationFields is true */}
            {showCitationFields ? (
              <div className="space-y-2 pt-1 border-t border-stone-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 uppercase">Documento</label>
                    <input
                      type="text"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded-lg text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 uppercase">Artículo / Numeral</label>
                    <input
                      type="text"
                      value={articleOrNumeral}
                      onChange={(e) => setArticleOrNumeral(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded-lg text-stone-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase">Fragmento de Texto Exacto</label>
                  <textarea
                    rows={3}
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded-lg text-stone-900 resize-none font-sans"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-700 italic border-l-2 border-amber-400 pl-2 line-clamp-3 leading-relaxed">
                "{excerpt.replace(/^["']|["']$/g, '')}"
              </p>
            )}
          </div>

          {/* Project Name Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Proyecto u Obra Asignada</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ej. Hospital Puyo, Puente Río Pastaza, Fiscalización..."
              className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white font-medium transition-all"
            />
            {allSuggestions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-stone-400 font-medium">Sugeridos:</span>
                {allSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setProjectName(sug)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 hover:bg-amber-100 hover:text-amber-900 transition-colors border border-stone-200"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes / Annotation Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              <span>Anotación Técnica o Justificación (Opcional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. 'Criterio para sustentar prórroga de plazo por lluvias', 'Cálculo de armadura mínima según NEC-SE-HM'..."
              className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Tag Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-stone-500" />
              <span>Etiqueta de Uso</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                'Obra / Fiscalización',
                'Especificación Técnica',
                'Pliegos / Términos de Referencia',
                'Administración de Contrato',
                'Diseño Estructural',
              ].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTag(t)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    selectedTag === t
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Guardar Cambios' : 'Guardar Marcador'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
