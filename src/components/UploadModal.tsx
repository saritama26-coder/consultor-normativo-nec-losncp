import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { NormativeCategory, NormativeDocument, NormativeStatus } from '../types/normative';
import { extractTextFromPDF } from '../utils/pdfExtractor';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentAdded: (doc: NormativeDocument) => void;
  adminToken: string | null;
  onRequireAdminLogin: () => void;
}

const CATEGORIES: { value: NormativeCategory; label: string }[] = [
  { value: '01 Constitución', label: '01. Constitución de la República del Ecuador (CRE)' },
  { value: '02 Contratación Pública', label: '02. Ley Orgánica del Sistema Nacional de Contratación Pública (LOSNCP)' },
  { value: '03 LOSNCP', label: '03. Reformas LOSNCP' },
  { value: '04 RGLOSNCP', label: '04. Reglamento General de la LOSNCP (RGLOSNCP)' },
  { value: '05 SERCOP', label: '05. Resoluciones y Normativa SERCOP' },
  { value: '06 Contraloría (LOCGE)', label: '06. Contraloría General del Estado (LOCGE y Normas Control)' },
  { value: '07 NEC (Construcción)', label: '07. Norma Ecuatoriana de la Construcción (NEC)' },
  { value: '08 INEN', label: '08. Normas Técnicas INEN de Ensayo y Materiales' },
  { value: '09 Seguridad y Salud', label: '09. Seguridad y Salud Ocupacional en Obras' },
  { value: '10 Accesibilidad', label: '10. Accesibilidad Universal y Medio Físico' },
  { value: '11 Ambiente', label: '11. Normativa Ambiental y Gestión de Escombros' },
  { value: '12 ARCSA', label: '12. Normativa Sanitaria e Instalaciones' },
  { value: '13 Bomberos', label: '13. Prevención y Protección contra Incendios' },
  { value: '14 COOTAD (GADs)', label: '14. COOTAD y Régimen Municipal' },
  { value: '15 Ordenanzas', label: '15. Ordenanzas Cantonales de Construcción' },
  { value: '16 Normativa Institucional / Otra', label: '16. Normativa Institucional / Otra' },
];

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onDocumentAdded,
  adminToken,
  onRequireAdminLogin,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [shortName, setShortName] = useState('');
  const [category, setCategory] = useState<NormativeCategory>('07 NEC (Construcción)');
  const [customCategory, setCustomCategory] = useState('');
  const [tipoNorma, setTipoNorma] = useState('Norma Técnica');
  const [numero, setNumero] = useState('');
  const [version, setVersion] = useState('Vigente');
  const [registroOficial, setRegistroOficial] = useState('');
  const [fechaPublicacion, setFechaPublicacion] = useState('');
  const [estado, setEstado] = useState<NormativeStatus>('VIGENTE');
  const [isHistorical, setIsHistorical] = useState(false);
  const [description, setDescription] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [scannedWarning, setScannedWarning] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    pageCount: number;
    pages: { pageNumber: number; text: string }[];
    isScanned: boolean;
    base64: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor selecciona un archivo PDF válido.');
      return;
    }

    setFile(selected);
    setError(null);
    setScannedWarning(false);
    setExtractedData(null);

    // Auto-fill shortName from filename without extension
    if (!shortName) {
      const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_|-]/g, ' ');
      setShortName(cleanName);
    }

    // Process PDF immediately to extract text and check if scanned
    setIsProcessing(true);
    setProgressText('Leyendo estructura del archivo PDF...');

    try {
      const result = await extractTextFromPDF(selected, (current, total) => {
        setProgressText(`Analizando páginas del PDF (${current} de ${total})...`);
      });

      setExtractedData(result);
      if (result.isScanned) {
        setScannedWarning(true);
      }
    } catch (err: any) {
      console.error('Error al procesar PDF:', err);
      setError('No se pudo procesar el PDF: ' + (err.message || 'Archivo corrupto o no compatible'));
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !extractedData) {
      setError('Debes seleccionar y esperar a que se procese el archivo PDF.');
      return;
    }

    if (!shortName.trim()) {
      setError('Por favor asigna un nombre oficial al documento.');
      return;
    }

    if (!adminToken) {
      onRequireAdminLogin();
      return;
    }

    setIsProcessing(true);
    setProgressText('Indexando en el File Search Store del servidor...');
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      };

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fileName: file.name,
          fileBase64: extractedData.base64,
          shortName: shortName.trim(),
          nombre: shortName.trim(),
          category,
          customCategory: category === '16 Normativa Institucional / Otra' ? customCategory : undefined,
          tipoNorma: tipoNorma.trim(),
          numero: numero.trim(),
          version: version.trim() || 'Vigente',
          registroOficial: registroOficial.trim(),
          fechaPublicacion,
          estado,
          isHistorical,
          description: description.trim(),
          isScanned: extractedData.isScanned,
          pageCount: extractedData.pageCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403 && errorData.requiresAdminAuth) {
          onRequireAdminLogin();
          throw new Error('Se requiere autenticación de administrador con ADMIN_PASSWORD.');
        }
        throw new Error(errorData.error || `Error del servidor (${response.status})`);
      }

      const newDoc: NormativeDocument = await response.json();
      onDocumentAdded(newDoc);
      onClose();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Ocurrió un error al subir el documento al store.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-stone-50 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Cargar Documento Normativo</h3>
              <p className="text-[11px] text-stone-500">Indexación técnica en el File Search Store</p>
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!adminToken && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>La carga de documentos requiere autenticación de administrador con ADMIN_PASSWORD.</span>
              </div>
              <button
                type="button"
                onClick={onRequireAdminLogin}
                className="text-[11px] font-bold text-stone-900 underline shrink-0 hover:text-stone-700"
              >
                Ingresar clave
              </button>
            </div>
          )}

          {/* PDF Drag & Drop Area */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Archivo PDF Oficial *
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                file
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-stone-300 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-xs font-bold text-stone-900 truncate max-w-[240px]">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                      {extractedData && ` · ${extractedData.pageCount} páginas`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-7 h-7 text-stone-400 mx-auto mb-1" />
                  <p className="text-xs font-medium text-stone-700">
                    Haz clic para seleccionar el archivo PDF
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Solo PDF oficial con texto extraíble (máx. 50 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Scanned PDF warning as strictly required */}
            {scannedWarning && (
              <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Aviso:</strong> Este documento parece escaneado o contiene poco texto seleccionable; las citas y la indexación pueden ser imprecisas.
                </p>
              </div>
            )}
          </div>

          {/* Short Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nombre Oficial del Documento *
            </label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Ej. LOSNCP Reformada, NEC-SE-DS Sismo, RGLOSNCP 2024"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Cuerpo Normativo / Categoría *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NormativeCategory)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white font-medium"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {category === '16 Normativa Institucional / Otra' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Especificar Categórica
              </label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Ej. Ordenanza GAD Quito, Manual MIDUVI"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white"
              />
            </div>
          )}

          {/* Version, Status & Register in a Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Versión / Edición
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Ej. Codificación 2024, Edición 2015"
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
                placeholder="Ej. R.O. Sup. 395"
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHistorical}
                onChange={(e) => setIsHistorical(e.target.checked)}
                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4"
              />
              <span className="text-xs font-medium text-stone-700">
                Documento histórico (archivado para consultas retroactivas)
              </span>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing || !file}
              className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[40px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progressText || 'Procesando...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Guardar e Indexar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
