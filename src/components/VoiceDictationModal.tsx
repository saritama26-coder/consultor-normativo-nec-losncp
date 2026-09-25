import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  X,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  HardHat,
  Volume2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceDictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  onInsertText: (text: string) => void;
  onSubmitQuery: (text: string) => void;
}

const TECHNICAL_CHIPS = [
  { label: "NEC-SE-DS (Sismo)", text: "según la norma NEC-SE-DS de diseño sismo resistente" },
  { label: "Hormigón f'c=210", text: "resistencia mínima del hormigón f'c de 210 kg/cm²" },
  { label: "Derivas de piso", text: "límites de deriva máxima inelástica de piso permitida" },
  { label: "Acero fy=4200", text: "especificación del acero de refuerzo con límite de fluencia fy=4200 kg/cm²" },
  { label: "LOSNCP Art. 81 (Recepción)", text: "según el artículo 81 de la LOSNCP sobre actas de entrega recepción" },
  { label: "Fórmula Polinómica", text: "aplicación de la fórmula polinómica para reajuste de precios de obra" },
  { label: "Fiscalización / Libro Obra", text: "responsabilidades y anotaciones obligatorias en el libro de obra por fiscalización" },
  { label: "Anticipo de Obra", text: "garantía de buen uso del anticipo y devengamiento contractual" },
  { label: "Terminación Unilateral", text: "causales y notificación de terminación unilateral del contrato de obra" },
];

export const VoiceDictationModal: React.FC<VoiceDictationModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  onInsertText,
  onSubmitQuery,
}) => {
  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    errorMessage,
    durationSeconds,
    audioLevel,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    appendTranscript,
  } = useSpeechRecognition({
    lang: 'es-EC',
    continuous: true,
    interimResults: true,
  });

  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // Initialize transcript when opened
  useEffect(() => {
    if (isOpen) {
      if (initialText) {
        setTranscript(initialText);
      }
      // Auto-start listening on modal open for rapid hands-free workflow
      startListening();
    } else {
      stopListening();
    }
  }, [isOpen]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  const handleCopy = async () => {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleInsertAndClose = () => {
    stopListening();
    if (fullText) {
      onInsertText(fullText);
    }
    onClose();
  };

  const handleImmediateSubmit = () => {
    stopListening();
    if (fullText) {
      onSubmitQuery(fullText);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white border border-stone-200 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header con diseño técnico para Obra */}
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="voice-modal-title" className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Dictado por Voz para Visitas a Obra
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-stone-950">
                  Web Speech API
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Dicta consultas sobre la marcha en obra, inspecciones o fiscalización
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopListening();
              onClose();
            }}
            className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors"
            title="Cerrar dictado"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic status bar with audio visualizer & duration */}
        <div className="bg-stone-100 border-b border-stone-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            {isListening ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                </span>
                <span className="font-semibold text-red-700 uppercase tracking-wider text-[11px]">
                  Escuchando ({formatTime(durationSeconds)})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-stone-500">
                <span className="inline-flex rounded-full h-2.5 w-2.5 bg-stone-400"></span>
                <span className="font-medium text-[11px]">Micrófono en pausa</span>
              </div>
            )}

            {/* Visualizer bars */}
            {isListening && (
              <div className="flex items-center gap-0.5 h-4 px-2 py-0.5 bg-stone-200/80 rounded-md">
                {[40, 75, 55, 90, 30, 85, 65, 95, 45, 70, 35, 80].map((heightPct, idx) => {
                  const factor = Math.min(100, Math.max(20, (audioLevel * heightPct) / 70));
                  return (
                    <span
                      key={idx}
                      className="w-1 bg-red-500 rounded-full transition-all duration-150"
                      style={{ height: `${Math.round(factor * 0.16)}px` }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-stone-500 text-[11px]">
            <span className="bg-white border border-stone-300 px-2 py-0.5 rounded-md font-mono text-[10px]">
              es-EC (Ecuador)
            </span>
            <button
              type="button"
              onClick={() => setShowTips(!showTips)}
              className="text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 font-medium"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Consejos de ruido</span>
            </button>
          </div>
        </div>

        {/* Tips expander */}
        {showTips && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-xs text-amber-900 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Recomendaciones para dictar en obra con maquinaria o viento:</p>
              <p className="text-[11px] text-amber-800">
                Acerca el teléfono a unos 10-15 cm de la boca. Habla pausado y pronuncia términos como &quot;NEC&quot;, &quot;LOSNCP&quot; o números de artículos con claridad. Si hay ruido excesivo, puedes tocar los atajos rápidos técnicos situados abajo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTips(false)}
              className="text-amber-700 hover:text-amber-950 font-bold ml-auto"
            >
              ×
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 text-xs text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={startListening}
              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded font-semibold text-[11px]"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Main Transcript Display Canvas */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 min-h-[160px] flex flex-col justify-between focus-within:ring-2 focus-within:ring-stone-900 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <span>Texto Transcrito</span>
                {fullText && (
                  <span className="font-mono text-stone-400">
                    {fullText.split(/\s+/).filter(Boolean).length} palabras
                  </span>
                )}
              </div>

              {fullText ? (
                <div className="text-base sm:text-lg text-stone-900 leading-relaxed font-normal whitespace-pre-wrap select-text">
                  <span>{transcript}</span>
                  {interimTranscript && (
                    <span className="text-amber-700 font-medium italic animate-pulse">
                      {transcript ? ' ' : ''}{interimTranscript}
                    </span>
                  )}
                  {isListening && (
                    <span className="inline-block w-1.5 h-4 bg-red-500 ml-1.5 animate-pulse align-middle" />
                  )}
                </div>
              ) : (
                <div className="text-stone-400 text-sm sm:text-base italic leading-relaxed py-6 flex flex-col items-center justify-center text-center">
                  <Mic className={`w-8 h-8 mb-2 ${isListening ? 'text-red-500 animate-bounce' : 'text-stone-300'}`} />
                  {isListening ? (
                    <p className="text-stone-600 font-medium">
                      Habla ahora. Di tu duda técnica sobre la NEC o LOSNCP...
                    </p>
                  ) : (
                    <p>Presiona el botón de micrófono abajo para comenzar a dictar.</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1 max-w-md">
                    Ejemplo: &quot;¿Cuáles son los requisitos de fiscalización para aprobar una planilla de liquidación de obra con reajuste de precios?&quot;
                  </p>
                </div>
              )}
            </div>

            {/* Quick action bar for transcript */}
            {fullText && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200/80 mt-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Copiar texto al portapapeles"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetTranscript}
                  className="px-2.5 py-1 text-xs text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Borrar texto grabado"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Borrar</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Technical Terms Chips (Obra) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <HardHat className="w-3.5 h-3.5 text-amber-600" />
                <span>Atajos Técnicos de Obra (Toca para insertar)</span>
              </span>
              <span className="text-[10px] text-stone-400 hidden sm:inline">
                Añade términos normativos exactos
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TECHNICAL_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => appendTranscript(chip.text)}
                  className="text-xs bg-stone-100 hover:bg-stone-200 active:bg-amber-100 text-stone-800 border border-stone-200 rounded-lg px-2.5 py-1 font-medium transition-colors hover:border-stone-300"
                >
                  + {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer controls: Primary big touch targets for field engineers */}
        <div className="bg-stone-50 border-t border-stone-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Mic toggle button (Extra prominent for gloved / field hands) */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={!isSupported}
              className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xs transition-all min-h-[48px] ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse ring-4 ring-red-200'
                  : 'bg-stone-900 hover:bg-stone-800 text-white'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>Pausar Micrófono</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 text-amber-400" />
                  <span>Activar Micrófono</span>
                </>
              )}
            </button>
          </div>

          {/* Action buttons */}
          <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={handleInsertAndClose}
              disabled={!fullText}
              className="flex-1 sm:flex-initial px-4 py-3 rounded-2xl font-semibold text-xs text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[48px]"
            >
              Insertar en Formulario
            </button>

            <button
              type="button"
              onClick={handleImmediateSubmit}
              disabled={!fullText}
              className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Consultar Ahora con IA</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
