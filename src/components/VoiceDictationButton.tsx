import React, { useState } from 'react';
import { Mic, MicOff, AlertCircle, HardHat } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  onOpenModal?: () => void;
  showExpandOption?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  disabled = false,
  onOpenModal,
  showExpandOption = false,
  className = '',
  size = 'md',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const {
    isListening,
    isSupported,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    lang: 'es-EC',
    continuous: true,
    interimResults: true,
    onFinalTranscript: (piece) => {
      onTranscript(piece);
    },
  });

  const toggleListening = () => {
    if (disabled || !isSupported) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        title="Dictado por voz no disponible en este navegador (requiere Chrome, Edge o Safari)"
        disabled
        className="p-2 text-stone-300 rounded-xl cursor-not-allowed min-w-[38px] min-h-[38px] flex items-center justify-center bg-stone-100"
      >
        <MicOff className="w-4 h-4" />
      </button>
    );
  }

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const buttonPaddings = {
    sm: 'p-1.5 min-w-[32px] min-h-[32px]',
    md: 'p-2 min-w-[38px] min-h-[38px]',
    lg: 'p-2.5 min-w-[44px] min-h-[44px]',
  };

  return (
    <div className={`relative inline-flex items-center gap-1 ${className}`}>
      {/* Live Interim Transcript Pill for instant visual confirmation while speaking */}
      {isListening && interimTranscript && (
        <div
          role="status"
          aria-live="polite"
          className="hidden md:flex items-center gap-1.5 bg-stone-900/90 text-white text-[11px] px-2.5 py-1 rounded-full shadow-lg border border-stone-700 animate-in fade-in"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="max-w-[200px] truncate text-stone-200 italic font-mono">
            {interimTranscript}
          </span>
        </div>
      )}

      {/* Main Mic Button */}
      <button
        type="button"
        onClick={toggleListening}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        aria-label={isListening ? 'Detener dictado por voz' : 'Iniciar dictado por voz para visitas a obra'}
        title={isListening ? 'Detener dictado por voz' : 'Dictar consulta por voz (Web Speech API)'}
        className={`${buttonPaddings[size]} rounded-xl transition-all flex items-center justify-center ${
          isListening
            ? 'bg-red-600 text-white animate-pulse shadow-md ring-2 ring-red-400'
            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 active:bg-stone-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isListening ? (
          <div className="flex items-center gap-1.5">
            <Mic className={`${iconSizes[size]} animate-bounce`} />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
              Grabando
            </span>
          </div>
        ) : (
          <Mic className={iconSizes[size]} />
        )}
      </button>

      {/* Optional expand button to open full Field Voice Modal */}
      {showExpandOption && onOpenModal && (
        <button
          type="button"
          onClick={onOpenModal}
          title="Abrir Modo Dictado en Obra (pantalla completa)"
          className="p-2 text-stone-500 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors hidden sm:flex items-center justify-center min-w-[38px] min-h-[38px]"
        >
          <HardHat className="w-4 h-4 text-amber-600" />
        </button>
      )}

      {/* Error alert toast */}
      {errorMessage && (
        <div
          role="alert"
          className="absolute bottom-full mb-2 right-0 z-50 bg-stone-950 text-white text-[11px] px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 max-w-xs border border-stone-800 animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
