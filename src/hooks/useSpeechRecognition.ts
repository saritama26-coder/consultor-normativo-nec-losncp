import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (errorMsg: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  errorMessage: string | null;
  durationSeconds: number;
  audioLevel: number;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
}

export function useSpeechRecognition({
  lang = 'es-EC',
  continuous = true,
  interimResults = true,
  onFinalTranscript,
  onError,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef(true);
  const timerRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);
  const onFinalCallbackRef = useRef(onFinalTranscript);
  const onErrorCallbackRef = useRef(onError);

  // Keep callback refs updated to avoid re-binding SpeechRecognition on every parent render
  useEffect(() => {
    onFinalCallbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onErrorCallbackRef.current = onError;
  }, [onError]);

  // Check support on mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  // Duration timer
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setDurationSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDurationSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening]);

  // Simulated dynamic audio level fluctuations during active listening for visual feedback
  useEffect(() => {
    if (!isListening) {
      setAudioLevel(0);
      return;
    }

    let intervalId = setInterval(() => {
      // Dynamic random pulse between 20% and 95%
      const base = 25 + Math.random() * 65;
      setAudioLevel(Math.round(base));
    }, 120);

    return () => clearInterval(intervalId);
  }, [isListening]);

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(35);
      }
    } catch {
      // Ignore haptic errors
    }
  };

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setErrorMessage('Tu navegador no soporta la API de Reconocimiento de Voz (Web Speech API). Usa Chrome, Edge o Safari.');
      return;
    }

    isManuallyStoppedRef.current = false;
    setErrorMessage(null);
    setInterimTranscript('');
    triggerHaptic();

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0].transcript;
          if (item.isFinal) {
            finalChunk += (finalChunk ? ' ' : '') + text;
          } else {
            currentInterim += text;
          }
        }

        if (finalChunk) {
          const cleanedChunk = finalChunk.trim();
          setTranscript((prev) => {
            const next = prev ? `${prev.trim()} ${cleanedChunk}` : cleanedChunk;
            return next;
          });
          if (onFinalCallbackRef.current) {
            onFinalCallbackRef.current(cleanedChunk);
          }
        }

        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        const error = event.error;
        let humanMessage = `Error de voz: ${error}`;

        if (error === 'not-allowed') {
          humanMessage = 'Permiso de micrófono denegado. Permite el acceso al micrófono en los ajustes del navegador para dictar.';
          isManuallyStoppedRef.current = true;
        } else if (error === 'audio-capture') {
          humanMessage = 'No se encontró ningún micrófono conectado en tu dispositivo.';
          isManuallyStoppedRef.current = true;
        } else if (error === 'network') {
          humanMessage = 'Problema de red con el servicio de transcripción de voz.';
        } else if (error === 'no-speech') {
          // Normal when silent during construction inspection, don't crash
          return;
        }

        setErrorMessage(humanMessage);
        if (onErrorCallbackRef.current) {
          onErrorCallbackRef.current(humanMessage);
        }
      };

      recognition.onend = () => {
        setInterimTranscript('');
        // If not manually stopped and continuous is desired, gracefully resume unless error occurred
        if (!isManuallyStoppedRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            // failed to restart, finalize
          }
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Speech recognition init error:', err);
      setIsListening(false);
      setErrorMessage('No se pudo iniciar el micrófono: ' + (err.message || 'Error desconocido'));
    }
  }, [lang, continuous, interimResults]);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    triggerHaptic();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const appendTranscript = useCallback((text: string) => {
    setTranscript((prev) => (prev ? `${prev.trim()} ${text.trim()}` : text.trim()));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isManuallyStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
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
  };
}
