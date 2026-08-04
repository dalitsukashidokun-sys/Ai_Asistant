import { useCallback, useEffect, useState } from 'react';
import { PetSprite } from './components/PetSprite';
import { SpeechBubble } from './components/SpeechBubble';
import { ChatInput } from './components/ChatInput';
import type { PetEmotionType, PetSegment, PetResponse } from './types/pet';
import './App.css';

export default function App() {
  const [emotion, setEmotion] = useState<PetEmotionType>('neutral');
  const [segmentos, setSegmentos] = useState<PetSegment[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  // Escuchadores IPC exclusivos para el entorno de Electron
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribeStartup = window.electronAPI.onStartupStatus((status) => {
      if (!status.ok && status.message) {
        setSegmentos([
          {
            texto: status.message,
            emocion: 'triste',
          },
        ]);
        setEmotion('triste');
      }
    });

    const unsubscribeReset = window.electronAPI.onConversationReset((payload) => {
      if ('segmentos' in payload && Array.isArray(payload.segmentos) && payload.segmentos.length > 0) {
        setSegmentos(payload.segmentos);
        setEmotion(payload.segmentos[0].emocion as PetEmotionType);
      }
    });

    return () => {
      unsubscribeStartup();
      unsubscribeReset();
    };
  }, []);

  const handleEmotionChange = useCallback((nuevaEmocion: string) => {
    setEmotion(nuevaEmocion as PetEmotionType);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (isThinking) return;

      setIsThinking(true);
      try {
        let respuesta: PetResponse;

        // ⚡ Detección de entorno: Electron IPC vs API Web/Vercel
        if (window.electronAPI) {
          respuesta = await window.electronAPI.chat(text);
        } else {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userText: text }),
          });

          if (!res.ok) {
            throw new Error('Error de conexión con el servidor web.');
          }

          respuesta = (await res.json()) as PetResponse;
        }

        setSegmentos(respuesta.segmentos);
      } catch (error) {
        console.error('[mascota-ia] Error al hablar con Gemini:', error);
        setSegmentos([
          {
            texto: error instanceof Error ? error.message : 'No he podido responder.',
            emocion: 'triste',
          },
        ]);
        setEmotion('triste');
      } finally {
        setIsThinking(false);
      }
    },
    [isThinking]
  );

  const handleSendWithScreen = useCallback(
    async (text: string) => {
      if (isThinking) return;

      setIsThinking(true);
      try {
        let respuesta: PetResponse;

        if (window.electronAPI) {
          respuesta = await window.electronAPI.chatWithScreen(text);
        } else {
          // En la web/móvil informamos de que la captura de pantalla de escritorio no está disponible
          respuesta = {
            segmentos: [
              {
                texto: 'La captura de pantalla completa solo está disponible en la app de escritorio.',
                emocion: 'atenta',
              },
            ],
          };
        }

        setSegmentos(respuesta.segmentos);
      } catch (error) {
        console.error('[mascota-ia] Error al capturar/enviar la pantalla:', error);
        setSegmentos([
          {
            texto: error instanceof Error ? error.message : 'No he podido ver la pantalla.',
            emocion: 'triste',
          },
        ]);
        setEmotion('triste');
      } finally {
        setIsThinking(false);
      }
    },
    [isThinking]
  );

  const handleReset = useCallback(() => {
    if (isThinking) return;

    if (window.electronAPI) {
      void window.electronAPI.resetConversation();
    } else {
      // En entorno Web/Vercel, reseteamos la vista localmente
      setSegmentos([
        {
          texto: 'Conversación reiniciada.',
          emocion: 'neutral',
        },
      ]);
      setEmotion('neutral');
    }
  }, [isThinking]);

  const handleSpeechError = useCallback((message: string) => {
    setSegmentos([
      {
        texto: message,
        emocion: 'triste',
      },
    ]);
    setEmotion('triste');
  }, []);

  return (
    <div className="pet-window">
      <SpeechBubble 
        segmentos={segmentos} 
        onEmotionChange={handleEmotionChange} 
      />
      <PetSprite emotion={emotion} isThinking={isThinking} />
      <ChatInput
        onSend={handleSend}
        onSendWithScreen={handleSendWithScreen}
        onReset={handleReset}
        onSpeechError={handleSpeechError}
        disabled={isThinking}
      />
    </div>
  );
}