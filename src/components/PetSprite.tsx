import type { PetEmotionType } from '../types/pet';

// Placeholders generados para que el proyecto arranque "de fábrica".
// Sustitúyelos por tus propios PNGs manteniendo el mismo nombre de archivo,
// o cambia las rutas aquí si prefieres otra convención de nombres.
import neutral from '../assets/sprites/neutral.png';
import feliz from '../assets/sprites/feliz.png';
import triste from '../assets/sprites/triste.png';
import avergonzada from '../assets/sprites/avergonzada.png';
import sorprendida from '../assets/sprites/sorprendida.png';
import enfadada from '../assets/sprites/enfadada.png';
import atenta from '../assets/sprites/atenta.png';

const SPRITES: Record<PetEmotionType, string> = {
  neutral,
  feliz,
  triste,
  avergonzada,
  sorprendida,
  enfadada,
  atenta,
};

interface PetSpriteProps {
  emotion: PetEmotionType;
  /** true mientras esperamos la respuesta de Gemini: aplica un estado visual sutil de "pensando". */
  isThinking?: boolean;
}

export function PetSprite({ emotion, isThinking = false }: PetSpriteProps) {
  return (
    <div className={`pet-sprite${isThinking ? ' pet-sprite--thinking' : ''}`}>
      <img src={SPRITES[emotion]} alt={`Expresión: ${emotion}`} draggable={false} />
    </div>
  );
}
