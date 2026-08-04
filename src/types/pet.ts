import { z } from 'zod';

/**
 * Enum cerrado de expresiones. Cada valor debe tener un PNG correspondiente
 * en src/assets/sprites/<valor>.png (ver PetSprite.tsx).
 *
 * Añadir una emoción nueva = añadir aquí + añadir su PNG + registrarla en
 * el mapa SPRITES de PetSprite.tsx.
 */
export const PetEmotion = z.enum([
  'neutral',
  'feliz',
  'triste',
  'avergonzada',
  'sorprendida',
  'enfadada',
  'atenta',
]);

export type PetEmotionType = z.infer<typeof PetEmotion>;

/**
 * Representa una escena/ventana individual de la Novela Visual.
 * Permite que cada frase tenga su propia longitud uniforme y su propia expresión facial.
 */
export const PetSegmentSchema = z.object({
  texto: z
    .string()
    .describe(
      'Frase corta hablada por el personaje para esta ventana (máximo 60-70 caracteres). Sin asteriscos ni acotaciones de acción entre paréntesis.'
    ),
  emocion: PetEmotion.describe(
    'La expresión facial que expresa el personaje en esta frase específica.'
  ),
});

export type PetSegment = z.infer<typeof PetSegmentSchema>;

/**
 * Contrato que exigimos a Gemini vía responseJsonSchema.
 * Devuelve un array de segmentos ordenados para paginar el diálogo y cambiar las emociones en tiempo real.
 */
export const PetResponseSchema = z.object({
  segmentos: z
    .array(PetSegmentSchema)
    .min(1)
    .describe(
      'Lista ordenada de escenas de novela visual que forman la réplica completa del personaje.'
    ),
});

export type PetResponse = z.infer<typeof PetResponseSchema>;

/**
 * Estado de arranque que main empuja al renderer una vez cargada la
 * ventana (ver electron/main.ts -> sendStartupStatus).
 */
export interface StartupStatus {
  ok: boolean;
  message?: string;
}