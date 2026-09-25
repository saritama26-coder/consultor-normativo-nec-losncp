import React, { useEffect, useMemo, useState } from 'react';
import { History, Star, Trash2, Library, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  ConsultationHistoryItem,
  ConsultationMode,
  NormativeDocument,
  SavedQuery,
} from '../types/normative';
import { getSavedQueries, setSavedQueries } from '../services/db';

type PanelTab = 'recientes' | 'guardadas' | 'biblioteca';

interface QuickAccessPanelProps {
  history: ConsultationHistoryItem[];
  documents: NormativeDocument[];
  currentQuestion: string;
  currentMode: ConsultationMode;
  onSelectQuestion: (question: string, mode?: ConsultationMode) => void;
  onNavigateToDocs: () => void;
  disabled?: boolean;
}

const MODE_LABEL: Record<ConsultationMode, string> = {
  rapida: 'Rápida',
  analisis: 'Análisis',
  informe: 'Informe',
};

const ESTADO_LABEL: Record<string, string> = {
  VIGENTE: 'Vigente',
  REFORMADA: 'Reformada',
  PARCIALMENTE_REFORMADA: 'Parcialmente reformada',
  DEROGADA: 'Derogada',
  'HISTÓRICA': 'Histórica',
  NO_VERIFICADA: 'No verificada',
};

const normalize = (q: string) => q.trim().replace(/\s+/g, ' ').toLowerCase();

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  history,
  documents,
  currentQuestion,
  currentMode,
  onSelectQuestion,
  onNavigateToDocs,
  disabled = false,
}) => {
  const [tab, setTab] = useState<PanelTab>('recientes');
  const [saved, setSaved] = useState<SavedQuery[]>([]);

  useEffect(() => {
    getSavedQueries().then(setSaved);
  }, []);

  const persist = (items: SavedQuery[]) => {
    setSaved(items);
    void setSavedQueries(items);
  };

  const isSaved = (q: string) => saved.some((s) => normalize(s.question) === normalize(q));

  const toggleSave = (question: string, mode?: ConsultationMode) => {
    const text = question.trim();
    if (!text) return;
    if (isSaved(text)) {
      persist(saved.filter((s) => normalize(s.question) !== normalize(text)));
    } else {
      persist([
        { id: `sq-${Date.now()}`, question: text, mode, createdAt: new Date().toISOString() },
        ...saved,
      ]);
    }
  };

  // Últimas 5 preguntas distintas del historial local
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: ConsultationHistoryItem[] = [];
    for (const item of history) {
      const key = normalize(item.question);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length === 5) break;
    }
    return out;
  }, [history]);

  const stats = useMemo(() => {
    const requiereRecarga = documents.filter(
      (d) => d.retrievalStatus === 'SIN_CLAVE' || d.retrievalStatus === 'NO_EXISTE_EN_STORE'
    );
    const pendientes = documents.filter((d) => d.retrievalStatus === 'PENDIENTE_REVISION');
    const activos = documents.filter((d) => d.isActive);
    return {
      total: documents.length,
      activos: activos.length,
      inactivos: documents.length - activos.length,
      requiereRecarga: requiereRecarga.length,
      pendientes: pendientes.length,
    };
  }, [documents]);

  const tabBtn = (id: PanelTab, label: string, icon: React.ReactNode, count?: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-bold rounded-lg transition-all min-h-[40px] ${
        tab === id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 rounded-full ${tab === id ? 'bg-white/20' : 'bg-stone-100'}`}>
          {count}
        </span>
      )}
    </button>
  );

  const questionRow = (
    key: string,
    question: string,
    mode: ConsultationMode | undefined,
    meta: string,
    action: React.ReactNode
  ) => (
    <li key={key} className="flex items-start gap-2 p-2.5 bg-stone-50/70 border border-stone-200/80 rounded-xl">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelectQuestion(question, mode)}
        className="flex-1 text-left disabled:opacity-50 group"
        title="Cargar esta pregunta en el cuadro de consulta"
      >
        <span className="block text-[12px] leading-relaxed font-medium text-stone-800 line-clamp-2 group-hover:text-stone-950">
          {question}
        </span>
        <span className="block mt-0.5 text-[10px] text-stone-500">
          {mode ? `${MODE_LABEL[mode]} · ` : ''}
          {meta}
        </span>
      </button>
      {action}
    </li>
  );

  return (
    <div className="mt-4 pt-4 border-t border-stone-200 space-y-3">
      <div className="flex gap-1 p-1 bg-stone-50 border border-stone-200 rounded-xl">
        {tabBtn('recientes', 'Recientes', <History className="w-3.5 h-3.5" />)}
        {tabBtn('guardadas', 'Guardadas', <Star className="w-3.5 h-3.5" />, saved.length)}
        {tabBtn('biblioteca', 'Biblioteca', <Library className="w-3.5 h-3.5" />)}
      </div>

      {tab === 'recientes' && (
        recent.length === 0 ? (
          <p className="text-[11px] text-stone-500 px-1">
            Aún no hay consultas en este navegador. Las últimas 5 aparecerán aquí.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((item) =>
              questionRow(
                item.id,
                item.question,
                item.mode,
                formatDate(item.timestamp),
                <button
                  type="button"
                  onClick={() => toggleSave(item.question, item.mode)}
                  className="p-1.5 rounded-lg hover:bg-stone-200 shrink-0"
                  title={isSaved(item.question) ? 'Quitar de guardadas' : 'Guardar esta consulta'}
                  aria-label={isSaved(item.question) ? 'Quitar de guardadas' : 'Guardar esta consulta'}
                >
                  <Star
                    className={`w-4 h-4 ${isSaved(item.question) ? 'fill-amber-400 text-amber-500' : 'text-stone-400'}`}
                  />
                </button>
              )
            )}
          </ul>
        )
      )}

      {tab === 'guardadas' && (
        <div className="space-y-2">
          <button
            type="button"
            disabled={!currentQuestion.trim() || isSaved(currentQuestion)}
            onClick={() => toggleSave(currentQuestion, currentMode)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-stone-800 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 disabled:opacity-50 min-h-[40px]"
          >
            <Star className="w-3.5 h-3.5" />
            {currentQuestion.trim() && isSaved(currentQuestion)
              ? 'La pregunta actual ya está guardada'
              : 'Guardar la pregunta actual'}
          </button>
          {saved.length === 0 ? (
            <p className="text-[11px] text-stone-500 px-1">
              No hay consultas guardadas. Use la estrella en Recientes o el botón de arriba.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {saved.map((s) =>
                questionRow(
                  s.id,
                  s.question,
                  s.mode,
                  `Guardada ${formatDate(s.createdAt)}`,
                  <button
                    type="button"
                    onClick={() => persist(saved.filter((x) => x.id !== s.id))}
                    className="p-1.5 rounded-lg hover:bg-stone-200 shrink-0"
                    title="Eliminar de guardadas"
                    aria-label="Eliminar de guardadas"
                  >
                    <Trash2 className="w-4 h-4 text-stone-400" />
                  </button>
                )
              )}
            </ul>
          )}
        </div>
      )}

      {tab === 'biblioteca' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-base font-bold text-emerald-900">{stats.activos}</div>
              <div className="text-[10px] text-emerald-800">Activos</div>
            </div>
            <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-base font-bold text-stone-900">{stats.inactivos}</div>
              <div className="text-[10px] text-stone-600">Inactivos</div>
            </div>
            <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-base font-bold text-stone-900">{stats.total}</div>
              <div className="text-[10px] text-stone-600">Total</div>
            </div>
          </div>

          {(stats.requiereRecarga > 0 || stats.pendientes > 0 || (stats.total > 0 && stats.activos === 0)) && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {stats.total > 0 && stats.activos === 0 && <p>Ningún documento está activo: las consultas no tendrán fuente.</p>}
                {stats.pendientes > 0 && <p>{stats.pendientes} restaurado(s) pendiente(s) de revisión y activación.</p>}
                {stats.requiereRecarga > 0 && <p>{stats.requiereRecarga} requiere(n) volver a subirse.</p>}
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <p className="text-[11px] text-stone-500 px-1">La biblioteca no tiene documentos cargados.</p>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {documents.map((d) => (
                <li key={d.id} className="p-2.5 bg-stone-50/70 border border-stone-200/80 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-stone-800 truncate">{d.name}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        d.isActive ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {d.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-stone-500">
                    {[
                      d.estado ? ESTADO_LABEL[d.estado] || d.estado : 'Estado no registrado',
                      d.fechaVigencia ? `Vigencia: ${d.fechaVigencia}` : '',
                      d.ultimaReforma ? `Última reforma: ${d.ultimaReforma}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={onNavigateToDocs}
            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-bold text-stone-800 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 min-h-[40px]"
          >
            <span>Ir a la Biblioteca</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
