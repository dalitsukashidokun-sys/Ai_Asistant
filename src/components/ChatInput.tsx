import { useState, type FormEvent } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendWithScreen: (text: string) => void;
  onReset: () => void;
  onSpeechError?: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onSendWithScreen, onReset, onSpeechError, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');

  // Al reconocer voz, enviamos directamente: así el flujo no exige un
  // segundo paso de pulsar Enter tras hablar.
  const { isSupported, isListening, startListening, stopListening } = useSpeechRecognition({
    onResult: (transcript) => {
      setValue('');
      onSend(transcript);
    },
    onError: onSpeechError,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  };

  const handleMicClick = () => {
    // Toggle en vez de "mantener pulsado": con un botón de 30px, un tap
    // rápido (muy fácil con ratón o trackpad) podía llamar a stop() antes
    // de que start() llegase a inicializar el micrófono, dando la
    // sensación de que el botón "no hacía nada". Con toggle, un solo clic
    // basta, y el propio reconocimiento se detiene solo al terminar la
    // frase (continuous = false en el hook) o con un segundo clic manual.
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleAskAboutScreen = () => {
    if (disabled) return;
    const text = value.trim() || '¿Qué ves en mi pantalla ahora mismo?';
    onSendWithScreen(text);
    setValue('');
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Habla con tu personaje…"
        disabled={disabled}
      />

      {isSupported && (
        <button
          type="button"
          className={`chat-input__icon-btn${isListening ? ' is-listening' : ''}`}
          disabled={disabled}
          title={isListening ? 'Escuchando… (clic para detener)' : 'Hablar por voz'}
          onClick={handleMicClick}
        >
          🎙
        </button>
      )}

      <button
        type="button"
        className="chat-input__icon-btn"
        disabled={disabled}
        title="Preguntar sobre lo que hay en pantalla"
        onClick={handleAskAboutScreen}
      >
        👁
      </button>

      <button
        type="button"
        className="chat-input__icon-btn"
        disabled={disabled}
        title="Empezar una conversación nueva (olvida el contexto actual)"
        onClick={onReset}
      >
        🔄
      </button>
    </form>
  );
}
