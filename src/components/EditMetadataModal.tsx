import React, { useState, useEffect } from 'react';
import { X, Save, Edit3, Loader2, AlertCircle } from 'lucide-react';
import { NormativeDocument, NormativeStatus } from '../types/normative';

interface EditMetadataModalProps {
  doc: NormativeDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<NormativeDocument>) => Promise<void>;
}

export const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  doc,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [tipoNorma, setTipoNorma] = useState('');
  const [numero, setNumero] = useState('');
  const [version, setVersion] = useState('');
  const [registroOficial, setRegistroOficial] = useState('');
  const [fechaPublicacion, setFechaPublicacion] = useState('');
  const [estado, setEstado] = useState<NormativeStatus>('VIGENTE');
  const [description, setDescription] = useState('');
  const [isHistorical, setIsHistorical] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (doc) {
      setName(doc.name || doc.nombre || '');
      setTipoNorma(doc.tipoNorma || '');
      setNumero(doc.numero || '');
      setVersion(doc.version || 'Vigente');
      setRegistroOficial(doc.registroOficial || '');
      setFechaPublicacion(doc.fechaPublicacion || '');
      setEstado(doc.estado || 'VIGENTE');
      setDescription(doc.description || '');
      setIsHistorical(Boolean(doc.isHistorical));
      setError(null);
    }
  }, [doc]);

  if (!isOpen || !doc) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre oficial del documento es obligatorio.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(doc.id, {
        name: name.trim(),
        nombre: name.trim(),
        tipoNorma: tipoNorma.trim(),
        numero: numero.trim(),
        version: version.trim(),
        registroOficial: registroOficial.trim(),
        fechaPublicacion: fechaPublicacion.trim(),
        estado,
        description: description.trim(),
        isHistorical,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar metadatos.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-stone-50 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Editar Ficha Normativa</h3>
              <p className="text-[11px] text-stone-500 font-mono truncate max-w-[280px]">{doc.fileName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nombre Oficial del Documento *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Tipo de Norma
              </label>
              <input
                type="text"
                value={tipoNorma}
                onChange={(e) => setTipoNorma(e.target.value)}
                placeholder="Ley, Decreto, Resolución..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Número Oficial
              </label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ej. Ley No. 2008-01"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Versión o Edición
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Ej. Codificación 2024"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Estado Normativo
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as NormativeStatus)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white font-medium"
              >
                <option value="VIGENTE">VIGENTE</option>
                <option value="REFORMADA">REFORMADA</option>
                <option value="PARCIALMENTE_REFORMADA">PARCIALMENTE REFORMADA</option>
                <option value="DEROGADA">DEROGADA</option>
                <option value="HISTÓRICA">HISTÓRICA</option>
                <option value="NO_VERIFICADA">NO VERIFICADA</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Registro Oficial
              </label>
              <input
                type="text"
                value={registroOficial}
                onChange={(e) => setRegistroOficial(e.target.value)}
                placeholder="Ej. R.O. Suplemento 395"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Fecha Publicación
              </label>
              <input
                type="date"
                value={fechaPublicacion}
                onChange={(e) => setFechaPublicacion(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={isHistorical}
                onChange={(e) => setIsHistorical(e.target.checked)}
                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4"
              />
              <span className="text-xs font-medium text-stone-700">
                Marcar como versión histórica (excluida de consultas ordinarias a menos que se soliciten expresamente)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Descripción o Alcance Técnico
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas técnicas sobre aplicación en obras..."
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Guardar Ficha</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
