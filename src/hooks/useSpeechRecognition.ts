import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * La Web Speech API vive bajo el prefijo `webkit` en todos los navegadores
 * basados en Chromium (y por tanto en Electron). No hay @types oficiales
 * para ella, así que declaramos aquí el subconjunto mínimo que usamos, en
 * vez de tirar de `any`.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

/** Traduce los códigos de error del navegador a algo que un humano entienda. */
function describeError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'permission-denied':
      return 'No tengo permiso para usar el micrófono. Revisa los permisos del sistema.';
    case 'no-speech':
      return 'No te he oído bien. Inténtalo de nuevo.';
    case 'audio-capture':
      return 'No encuentro ningún micrófono conectado.';
    case 'network':
      return 'Fallo de red en el reconocimiento de voz (necesita conexión a internet).';
    default:
      return 'No he podido reconocer tu voz.';
  }
}

interface UseSpeechRecognitionOptions {
  /** Código de idioma BCP 47. Por defecto español de España. */
  lang?: string;
  /** Se llama con el texto reconocido cuando el usuario termina de hablar. */
  onResult: (transcript: string) => void;
  /** Se llama con un mensaje ya traducido a español cuando algo falla. */
  onError?: (message: string) => void;
}

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export function useSpeechRecognition({
  lang = 'es-ES',
  onResult,
  onError,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && 'webkitSpeechRecognition' in window
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Refs para los callbacks: así el efecto de abajo no necesita reconstruir
  // el objeto SpeechRecognition cada vez que `onResult`/`onError` cambian
  // de identidad entre renders (evita reinicios innecesarios si el usuario
  // está hablando justo cuando el componente padre se vuelve a renderizar).
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!isSupported || !window.webkitSpeechRecognition) return;

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript;
      onResultRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      onErrorRef.current?.(describeError(event.error));
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [isSupported, lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setIsListening(true);
    recognitionRef.current.start();
  }, [isListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isSupported, isListening, startListening, stopListening };
}
