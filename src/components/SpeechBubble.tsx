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

  // Al recibir un nuevo array de segmentos, reseteamos a la escena 0 y emitimos la emoción inicial
  useEffect(() => {
    setCurrentPage(0);
    if (segmentos && segmentos.length > 0) {
      onEmotionChange(segmentos[0].emocion);
    }
  }, [segmentos]);

  if (!segmentos || segmentos.length === 0) return null;

  const changePage = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < segmentos.length) {
      setCurrentPage(newIndex);
      // ⚡ Notificamos el cambio de emoción de este segmento específico al componente padre (App.tsx / PetSprite)
      onEmotionChange(segmentos[newIndex].emocion);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    changePage(currentPage + 1);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    changePage(currentPage - 1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY > 0) {
      handleNext();
    } else if (e.deltaY < 0) {
      handlePrev();
    }
  };

  const currentSegment = segmentos[currentPage];

  return (
    <div 
      className={`speech-bubble emotion-${currentSegment.emocion}`}
      onWheel={handleWheel}
      onClick={() => handleNext()}
    >
      <div className="bubble-content">
        <p className="dialogue-text">{currentSegment.texto}</p>
      </div>

      {segmentos.length > 1 && (
        <div className="vn-controls" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            className="vn-btn" 
            onClick={handlePrev} 
            disabled={currentPage === 0}
            aria-label="Página anterior"
          >
            ‹
          </button>

          <div className="vn-dots">
            {segmentos.map((_, index) => (
              <span
                key={index}
                className={`vn-dot ${index === currentPage ? 'active' : ''}`}
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
            disabled={currentPage === segmentos.length - 1}
            aria-label="Página siguiente"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};