import React, { useState, useEffect } from 'react';
import type { PetSegment } from '../types/pet.js';
import './SpeechBubble.css';

interface SpeechBubbleProps {
  segmentos: PetSegment[];
  onEmotionChange: (emocion: string) => void;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ 
  segmentos, 
  onEmotionChange 
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Al recibir un nuevo array de segmentos, reseteamos a la escena 0 y emitimos la emoción inicial de forma segura
  useEffect(() => {
    setCurrentPage(0);
    if (segmentos && segmentos.length > 0 && segmentos[0]?.emocion) {
      onEmotionChange(segmentos[0].emocion);
    }
  }, [segmentos]);

  if (!segmentos || segmentos.length === 0) return null;

  // Validación de seguridad por si currentPage queda fuera de rango
  const validIndex = Math.min(Math.max(0, currentPage), segmentos.length - 1);
  const currentSegment = segmentos[validIndex];

  // Si el segmento actual es undefined o no tiene texto/emoción, evitamos el render
  if (!currentSegment) return null;

  const currentEmotion = currentSegment.emocion || 'neutral';
  const currentText = currentSegment.texto || '';

  const changePage = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < segmentos.length) {
      setCurrentPage(newIndex);
      const targetSegment = segmentos[newIndex];
      if (targetSegment?.emocion) {
        onEmotionChange(targetSegment.emocion);
      }
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    changePage(validIndex + 1);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    changePage(validIndex - 1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY > 0) {
      handleNext();
    } else if (e.deltaY < 0) {
      handlePrev();
    }
  };

  return (
    <div 
      className={`speech-bubble emotion-${currentEmotion}`}
      onWheel={handleWheel}
      onClick={() => handleNext()}
    >
      <div className="bubble-content">
        <p className="dialogue-text">{currentText}</p>
      </div>

      {segmentos.length > 1 && (
        <div className="vn-controls" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            className="vn-btn" 
            onClick={handlePrev} 
            disabled={validIndex === 0}
            aria-label="Página anterior"
          >
            ‹
          </button>

          <div className="vn-dots">
            {segmentos.map((_, index) => (
              <span
                key={index}
                className={`vn-dot ${index === validIndex ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  changePage(index);
                }}
              />
            ))}
          </div>

          <button 
            type="button"
            className="vn-btn" 
            onClick={handleNext} 
            disabled={validIndex === segmentos.length - 1}
            aria-label="Página siguiente"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};