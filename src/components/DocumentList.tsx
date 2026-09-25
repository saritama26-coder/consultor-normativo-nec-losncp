import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  AlertTriangle,
  FolderOpen,
  Server,
  Lock,
  Unlock,
  Edit3,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Hash,
} from 'lucide-react';
import { NormativeDocument, NormativeStatus } from '../types/normative';
import { EditMetadataModal } from './EditMetadataModal';

interface DocumentListProps {
  documents: NormativeDocument[];
  onToggleActive: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onUpdateDocument: (id: string, updates: Partial<NormativeDocument>) => Promise<void>;
  onOpenUploadModal: () => void;
  isAdminLoggedIn: boolean;
  isAdminConfigured: boolean;
  onOpenAdminLogin: () => void;
  highlightedDocId?: string | null;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onToggleActive,
  onDeleteDocument,
  onUpdateDocument,
  onOpenUploadModal,
  isAdminLoggedIn,
  isAdminConfigured,
  onOpenAdminLogin,
  highlightedDocId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [editingDoc, setEditingDoc] = useState<NormativeDocument | null>(null);

  const activeCount = documents.filter((d) => d.isActive).length;

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        !searchTerm.trim() ||
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.version && doc.version.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (doc.registroOficial && doc.registroOficial.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategory === 'TODAS' ||
        doc.category === selectedCategory ||
        (doc.category.includes(selectedCategory));

      return matchesSearch && matchesCat;
    });
  }, [documents, searchTerm, selectedCategory]);

  const getCategoryBadgeClass = (category: string) => {
    if (category.includes('Constitución') || category === 'CRE') return 'text-purple-800 bg-purple-50 border-purple-200';
    if (category.includes('NEC')) return 'text-blue-800 bg-blue-50 border-blue-200';
    if (category.includes('LOSNCP')) return 'text-emerald-800 bg-emerald-50 border-emerald-200';
    if (category.includes('RGLOSNCP')) return 'text-amber-800 bg-amber-50 border-amber-200';
    if (category.includes('Contraloría') || category === 'LOCGE') return 'text-rose-800 bg-rose-50 border-rose-200';
    if (category.includes('COOTAD')) return 'text-teal-800 bg-teal-50 border-teal-200';
    if (category.includes('SERCOP')) return 'text-cyan-800 bg-cyan-50 border-cyan-200';
    if (category.includes('INEN')) return 'text-indigo-800 bg-indigo-50 border-indigo-200';
    if (category.includes('Bomberos') || category.includes('Seguridad')) return 'text-orange-800 bg-orange-50 border-orange-200';
    return 'text-stone-800 bg-stone-100 border-stone-200';
  };

  const getStatusBadge = (estado?: NormativeStatus, isHistorical?: boolean) => {
    if (isHistorical || estado === 'HISTÓRICA') {
      return <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded">HISTÓRICA</span>;
    }
    switch (estado) {
      case 'VIGENTE':
        return <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">VIGENTE</span>;
      case 'REFORMADA':
        return <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">REFORMADA</span>;
      case 'PARCIALMENTE_REFORMADA':
        return <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">PARC. REFORMADA</span>;
      case 'DEROGADA':
        return <span className="text-[10px] font-semibold text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded">DEROGADA</span>;
      default:
        return <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded">OFICIAL</span>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleActionGuarded = (action: () => void) => {
    if (!isAdminLoggedIn) {
      onOpenAdminLogin();
      return;
    }
    action();
  };

  return (
    <div className="space-y-6">
      {/* Top action & admin status bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-stone-900">Biblioteca Normativa Oficial</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded">
                <Server className="w-3 h-3" />
                File Search Store
              </span>
              {isAdminLoggedIn ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <Unlock className="w-3 h-3 text-emerald-600" />
                  Admin Autenticado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-200 px-2 py-0.5 rounded transition-colors"
                  title="Ingresar como Administrador con ADMIN_PASSWORD"
                >
                  <Lock className="w-3 h-3 text-stone-500" />
                  Modo Público (Acceso Libre)
                </button>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {documents.length} documentos indexados · {activeCount} activos para consultas técnico-legales
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleActionGuarded(onOpenUploadModal)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-colors min-h-[44px] sm:min-h-0"
            >
              <Plus className="w-4 h-4" />
              <span>Cargar PDF oficial</span>
            </button>
          </div>
        </div>

        {/* Search and Category Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-stone-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, código o Registro Oficial..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-stone-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-stone-900"
            >
              <option value="TODAS">Todas las categorías</option>
              <option value="Constitución">Constitución (CRE)</option>
              <option value="LOSNCP">LOSNCP</option>
              <option value="RGLOSNCP">RGLOSNCP</option>
              <option value="SERCOP">SERCOP</option>
              <option value="Contraloría">Contraloría (LOCGE)</option>
              <option value="NEC">NEC (Construcción)</option>
              <option value="COOTAD">COOTAD</option>
              <option value="INEN">INEN</option>
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {documents.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-stone-300">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-800 mb-1">
            Carga al menos un documento normativo para empezar.
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto mb-6 leading-relaxed">
            Sube los archivos PDF oficiales de la normativa que deseas consultar (Constitución de la República, NEC, LOSNCP, RGLOSNCP, LOCGE, COOTAD, etc.).
            Se indexan directamente en el servidor para que estén disponibles con verificación exacta de citas.
          </p>
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => handleActionGuarded(onOpenUploadModal)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Cargar primer PDF oficial</span>
            </button>
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-stone-200">
          <p className="text-xs text-stone-500">No se encontraron documentos con los filtros seleccionados.</p>
        </div>
      ) : (
        /* Document Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              id={`doc-${doc.id}`}
              className={`p-4 rounded-2xl border transition-all bg-white flex flex-col justify-between ${
                highlightedDocId === doc.id
                  ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/30 shadow-md'
                  : doc.isActive
                  ? 'border-stone-300 shadow-xs'
                  : 'border-stone-200 opacity-60 bg-stone-50/50'
              }`}
            >
              <div>
                {/* Header card info */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span
                        className={`text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                          doc.category
                        )}`}
                      >
                        {doc.category}
                      </span>
                      {getStatusBadge(doc.estado, doc.isHistorical)}
                      {doc.retrievalStatus && doc.retrievalStatus !== 'OK' && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200"
                          title="Este documento no participa en la recuperación de evidencia hasta resolver su estado."
                        >
                          {doc.retrievalStatus === 'SIN_CLAVE'
                            ? 'Requiere volver a subir'
                            : doc.retrievalStatus === 'NO_EXISTE_EN_STORE'
                            ? 'No existe en el store'
                            : 'Restaurado · activar para usar'}
                        </span>
                      )}
                      {highlightedDocId === doc.id && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                          <span>Actualizado en Servidor</span>
                        </span>
                      )}
                      {doc.registroOficial && (
                        <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded border border-stone-200 truncate max-w-[140px]">
                          {doc.registroOficial}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-stone-900 leading-snug">
                      {doc.name}
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5 font-normal flex items-center gap-2">
                      <span>{doc.version || 'Edición Vigente'}</span>
                      {doc.pageCount && <span className="text-stone-400">· {doc.pageCount} págs.</span>}
                      {doc.fileSize > 0 && <span className="text-stone-400">· {formatFileSize(doc.fileSize)}</span>}
                    </p>
                  </div>

                  {/* Active Toggle Switch */}
                  <label
                    className="relative inline-flex items-center cursor-pointer shrink-0 mt-1"
                    title={
                      doc.isActive
                        ? 'Activo: se utilizará como evidencia en consultas'
                        : 'Desactivado: excluido estrictamente de consultas'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={doc.isActive}
                      onChange={() => handleActionGuarded(() => onToggleActive(doc.id))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-stone-900"></div>
                  </label>
                </div>

                {/* Scanned Warning Notification */}
                {doc.isScanned && (
                  <div className="mt-2 mb-2 p-2 bg-amber-50 border border-amber-200/70 rounded-lg flex items-start gap-2 text-amber-900 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>Este documento parece escaneado; las citas pueden ser imprecisas.</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Metadata, SHA-256 preview & Actions */}
              <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <div className="flex items-center gap-1.5 truncate max-w-[200px]" title={`Archivo: ${doc.fileName}${doc.fileHash ? ` | Hash: ${doc.fileHash}` : ''}`}>
                  <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate text-[11px] font-mono text-stone-500">{doc.fileName}</span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Edit Metadata Button */}
                  <button
                    type="button"
                    onClick={() => handleActionGuarded(() => setEditingDoc(doc))}
                    className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Editar ficha y metadatos del documento"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => {
                      handleActionGuarded(() => {
                        if (window.confirm(`¿Eliminar el documento "${doc.name}" del File Search Store en el servidor?`)) {
                          onDeleteDocument(doc.id);
                        }
                      });
                    }}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Eliminar documento del servidor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Metadata Modal */}
      <EditMetadataModal
        doc={editingDoc}
        isOpen={Boolean(editingDoc)}
        onClose={() => setEditingDoc(null)}
        onSave={async (id, updates) => {
          await onUpdateDocument(id, updates);
        }}
      />
    </div>
  );
};
