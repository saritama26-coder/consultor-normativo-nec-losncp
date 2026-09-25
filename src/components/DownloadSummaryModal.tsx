import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileCheck2,
  Building2,
  UserCheck,
  ClipboardList,
  Check,
  Copy,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { CitationGroup } from '../types/normative';
import {
  downloadSummaryPDF,
  downloadSummaryTXT,
  SummaryExportData,
} from '../utils/summaryDownloader';

interface DownloadSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  keyPoints: string[];
  directAnswer?: string;
  confidenceLabel?: string;
  documentNames?: string[];
  citations?: CitationGroup[];
  timestamp?: string;
}

export const DownloadSummaryModal: React.FC<DownloadSummaryModalProps> = ({
  isOpen,
  onClose,
  question,
  keyPoints,
  directAnswer,
  confidenceLabel,
  documentNames,
  citations,
  timestamp,
}) => {
  const [projectName, setProjectName] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [bookEntryNumber, setBookEntryNumber] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingTxt, setIsExportingTxt] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<'pdf' | 'txt' | 'copy' | null>(null);

  if (!isOpen) return null;

  const getExportData = (): SummaryExportData => ({
    question,
    keyPoints,
    directAnswer,
    confidenceLabel,
    documentNames,
    citations,
    timestamp,
    projectName: projectName.trim() || undefined,
    contractorName: contractorName.trim() || undefined,
    inspectorName: inspectorName.trim() || undefined,
    bookEntryNumber: bookEntryNumber.trim() || undefined,
  });

  const handleDownloadPDF = async () => {
    try {
      setIsExportingPdf(true);
      await downloadSummaryPDF(getExportData());
      setDownloadSuccess('pdf');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadTXT = () => {
    try {
      setIsExportingTxt(true);
      downloadSummaryTXT(getExportData());
      setDownloadSuccess('txt');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Error al descargar TXT:', err);
    } finally {
      setIsExportingTxt(false);
    }
  };

  const handleCopyText = async () => {
    try {
      const data = getExportData();
      const proj = data.projectName || '[Sin especificar]';
      let text = `FICHA DE CONCLUSIONES TÉCNICAS PARA INFORME DE OBRA\n`;
      text += `PROYECTO: ${proj}\n`;
      text += `CONSULTA: ${data.question}\n`;
      text += `FECHA: ${new Date().toLocaleDateString('es-EC')}\n\n`;
      text += `CONCLUSIONES Y PUNTOS CLAVE:\n`;
      data.keyPoints.forEach((p, idx) => {
        text += `[${idx + 1}] ${p}\n`;
      });
      if (data.directAnswer) {
        text += `\nCRITERIO TÉCNICO DIRECTO:\n${data.directAnswer}\n`;
      }
      await navigator.clipboard.writeText(text);
      setDownloadSuccess('copy');
      setTimeout(() => setDownloadSuccess(null), 2500);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-1.5">
                <span>Descargar Conclusiones para Informe de Obra</span>
              </h3>
              <p className="text-xs text-amber-100">
                Guarda la síntesis técnica en PDF formal o texto plano para libros de obra y fiscalización
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-sm text-stone-700">
          {/* Quick Notice */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900">Resumen listo para descargar:</span>{' '}
              Se incluirán los <strong>{keyPoints.length} puntos clave</strong> de conclusiones técnicas,
              referencias legales y recuadro de constancia para bitácora o libro de obra.
            </div>
          </div>

          {/* Optional Work / Project Fields */}
          <div className="space-y-3 bg-stone-50/80 p-3.5 rounded-xl border border-stone-200">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Datos Opcionales para Encabezado de Obra</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Puedes completar estos datos para que aparezcan impresos en la ficha técnica, o dejarlos vacíos para llenarlos a mano en obra.
            </p>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nombre del Proyecto / Obra:
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej. Construcción de Red de Alcantarillado Parroquia Central"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-stone-500" />
                    <span>Residente de Obra / Constructor:</span>
                  </label>
                  <input
                    type="text"
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    placeholder="Ing. / Arq. Nombre Apellido"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-stone-500" />
                    <span>Fiscalizador / Supervisor:</span>
                  </label>
                  <input
                    type="text"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    placeholder="Ing. Fiscalizador Nombre"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <ClipboardList className="w-3 h-3 text-stone-500" />
                  <span>N° de Asiento / Folio de Libro de Obra:</span>
                </label>
                <input
                  type="text"
                  value={bookEntryNumber}
                  onChange={(e) => setBookEntryNumber(e.target.value)}
                  placeholder="Ej. Folio 042 / Asiento 18"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Key points preview */}
          <div>
            <span className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
              Vista Previa de Conclusiones a Exportar:
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-3 bg-stone-50 border border-stone-200 rounded-xl">
              {keyPoints.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-stone-800">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-stone-100/80 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyText}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-colors"
          >
            {downloadSuccess === 'copy' ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-700">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-stone-500" />
                <span>Copiar Texto</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Download Plain Text Button */}
            <button
              type="button"
              onClick={handleDownloadTXT}
              disabled={isExportingTxt}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-all shadow-2xs hover:shadow-xs disabled:opacity-50"
              title="Descargar conclusiones en archivo de texto plano (.txt)"
            >
              {isExportingTxt ? (
                <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
              ) : downloadSuccess === 'txt' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <FileText className="w-4 h-4 text-amber-700" />
              )}
              <span>
                {downloadSuccess === 'txt' ? '¡Descargado!' : 'Descargar TXT (.txt)'}
              </span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs hover:shadow-md disabled:opacity-50"
              title="Descargar Ficha Técnica en PDF formal para informe de obra"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : downloadSuccess === 'pdf' ? (
                <>
                  <FileCheck2 className="w-4 h-4 text-emerald-200" />
                  <span>¡PDF Generado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF (Ficha de Obra)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
