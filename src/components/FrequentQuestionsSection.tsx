import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  ArrowRight,
  BookOpen,
  FileText,
  ShieldAlert,
  HardHat,
  Scale,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FREQUENT_QUESTIONS_DATA, FrequentQuestionItem } from '../data/frequentQuestions';
import { ConsultationMode } from '../types/normative';

interface FrequentQuestionsSectionProps {
  onSelectQuestion: (question: string, autoSubmit?: boolean, suggestedMode?: ConsultationMode) => void;
  disabled?: boolean;
  activeCategory?: 'ALL' | 'NEC' | 'LOSNCP';
}

export const FrequentQuestionsSection: React.FC<FrequentQuestionsSectionProps> = ({
  onSelectQuestion,
  disabled = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'NEC' | 'LOSNCP'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredQuestions = FREQUENT_QUESTIONS_DATA.filter((item) => {
    const matchesCategory =
      selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      searchFilter.trim() === '' ||
      item.question.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.topic.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.normaRef.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.description.toLowerCase().includes(searchFilter.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const countNEC = FREQUENT_QUESTIONS_DATA.filter((q) => q.category === 'NEC').length;
  const countLOSNCP = FREQUENT_QUESTIONS_DATA.filter((q) => q.category === 'LOSNCP').length;

  const handleLoadQuestion = (item: FrequentQuestionItem, autoSubmit: boolean) => {
    setCopiedId(item.id);
    onSelectQuestion(item.question, autoSubmit, item.suggestedMode);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-200">
      {/* Encabezado de la sección */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-stone-100 text-stone-800 rounded-lg">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Consultas Frecuentes
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                NEC & LOSNCP
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden sm:block">
              Preguntas formuladas con precisión jurídica y técnica para acelerar tu fiscalización o diseño
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-stone-500 hover:text-stone-900 text-xs font-medium inline-flex items-center gap-1 p-1 rounded-md hover:bg-stone-100 transition-colors"
          title={isExpanded ? 'Contraer consultas frecuentes' : 'Expandir consultas frecuentes'}
        >
          <span>{isExpanded ? 'Ocultar' : 'Mostrar'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Categorías (Pills) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  selectedCategory === 'ALL'
                    ? 'bg-stone-900 text-white shadow-2xs font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                }`}
              >
                <span>Todas</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === 'ALL' ? 'bg-stone-700 text-stone-100' : 'bg-stone-200 text-stone-600'
                }`}>
                  {FREQUENT_QUESTIONS_DATA.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('NEC')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  selectedCategory === 'NEC'
                    ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                    : 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100'
                }`}
              >
                <HardHat className="w-3.5 h-3.5" />
                <span>NEC (Construcción)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === 'NEC' ? 'bg-amber-700 text-amber-100' : 'bg-amber-100 text-amber-800'
                }`}>
                  {countNEC}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('LOSNCP')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  selectedCategory === 'LOSNCP'
                    ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                    : 'bg-blue-50 text-blue-900 border border-blue-200/80 hover:bg-blue-100'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>LOSNCP (Contratación)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === 'LOSNCP' ? 'bg-blue-700 text-blue-100' : 'bg-blue-100 text-blue-800'
                }`}>
                  {countLOSNCP}
                </span>
              </button>
            </div>

            {/* Buscador rápido de preguntas frecuentes */}
            <div className="relative min-w-[180px] sm:w-56">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar preguntas..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-1 focus:ring-stone-900 focus:bg-white"
              />
            </div>
          </div>

          {/* Grid de preguntas frecuentes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {filteredQuestions.length === 0 ? (
              <div className="col-span-full p-4 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-stone-200">
                No se encontraron preguntas frecuentes que coincidan con &quot;{searchFilter}&quot;.
              </div>
            ) : (
              filteredQuestions.map((item) => {
                const isCopied = copiedId === item.id;
                const isNEC = item.category === 'NEC';

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-stone-50/80 hover:bg-white border border-stone-200/90 hover:border-stone-300 rounded-xl transition-all flex flex-col justify-between gap-2.5 group"
                  >
                    <div className="space-y-1.5">
                      {/* Cabecera de la tarjeta: Badge de Norma y Tema */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isNEC
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {item.normaRef}
                        </span>

                        <span className="text-[10px] font-medium text-stone-500">
                          {item.topic}
                        </span>
                      </div>

                      {/* Texto de la pregunta */}
                      <p className="text-xs font-semibold text-stone-900 leading-snug group-hover:text-stone-950">
                        {item.question}
                      </p>

                      {/* Breve descripción o alcance técnico */}
                      <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                      {item.suggestedMode && (
                        <span className="text-[10px] text-stone-400 capitalize">
                          Modo sugerido: <strong className="text-stone-600 font-semibold">{item.suggestedMode}</strong>
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleLoadQuestion(item, false)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                            isCopied
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-white text-stone-700 hover:text-stone-900 border-stone-200 hover:bg-stone-50'
                          }`}
                          title="Cargar esta pregunta en el campo de texto para editarla"
                        >
                          {isCopied ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Cargada
                            </span>
                          ) : (
                            'Cargar en texto'
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleLoadQuestion(item, true)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 rounded-lg shadow-2xs transition-all flex items-center gap-1"
                          title="Cargar y consultar inmediatamente en la biblioteca normativa"
                        >
                          <span>Consultar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
