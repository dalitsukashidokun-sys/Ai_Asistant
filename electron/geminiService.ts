import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';
import { PetResponseSchema, type PetResponse } from '../src/types/pet.js';

// ============================================================================
// ⚙️ CAMBIO DE MODELO DE GEMINI
// Si necesitas cambiar de modelo (ej. por límites de cuota), modifica la
// siguiente variable con el identificador deseado.
// ============================================================================
const MODEL_NAME = 'gemini-3.5-flash-lite';

const SYSTEM_INSTRUCTION = `
Eres el motor narrativo de una mascota de escritorio para roleplay de un solo personaje.
Permanece siempre en el personaje que te indique el usuario en la conversación.

Reglas para la generación de la respuesta:
1. Divide tu réplica en una lista de 'segmentos' para paginar la conversación estilo novela visual.
2. Cada fragmento de 'texto' debe ser breve (máximo 60-70 caracteres por escena).
3. Selecciona la 'emocion' concreta que expresa el personaje en cada 'texto' específico.
4. El campo 'texto' es SOLO la voz hablada: nunca incluyas asteriscos, acotaciones entre paréntesis ni texto fuera de personaje.
`.trim();

// Convertimos el schema de Zod a JSON Schema una sola vez al arrancar
const { $schema: _omit, ...responseJsonSchema } = PetResponseSchema.toJSONSchema();

const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 25_000;
const MAX_HISTORY_ENTRIES = 40;

let client: GoogleGenAI | null = null;
let history: Content[] = [];

function getClient(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta GEMINI_API_KEY. Copia .env.example a .env y añade tu clave de https://aistudio.google.com/apikey'
    );
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

/** Quita fences ```json ... ``` por si el modelo los añadiera */
function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

/** Olvida la conversación actual */
export function resetConversation(): void {
  history = [];
}

async function callGemini(userParts: Part[]): Promise<PetResponse> {
  const ai = getClient();
  const contents: Content[] = [...history, { role: 'user', parts: userParts }];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let rawText: string;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema,
        abortSignal: controller.signal,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    rawText = response.text ?? '{}';
  } catch (error: any) {
    if (controller.signal.aborted) {
      throw new Error('Gemini ha tardado demasiado en responder (timeout). Inténtalo de nuevo.');
    }

    // ⚠️ CAPTURA DE ERROR DE CUOTA (429 / RESOURCE_EXHAUSTED)
    const isQuotaError = 
      error?.status === 429 || 
      error?.message?.includes('429') || 
      error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      return {
        segmentos: [
          {
            texto: "Niko, he alcanzado el límite de peticiones con la API por ahora.",
            emocion: "triste"
          },
          {
            texto: "Por favor, dame unos momentos antes de continuar.",
            emocion: "triste"
          }
        ]
      };
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const parsed = PetResponseSchema.parse(JSON.parse(extractJsonText(rawText)));

  // Consolidamos todos los fragmentos de diálogo en una sola cadena para mantener
  // un historial limpio y coherente dentro del contexto de Gemini.
  const textoCompleto = parsed.segmentos.map((s) => s.texto).join(' ');

  history.push({ role: 'user', parts: userParts });
  history.push({ role: 'model', parts: [{ text: textoCompleto }] });
  
  if (history.length > MAX_HISTORY_ENTRIES) {
    history = history.slice(history.length - MAX_HISTORY_ENTRIES);
  }

  return parsed;
}

const MAX_USER_TEXT_LENGTH = 4000;

function assertValidUserText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('El mensaje está vacío.');
  }
  if (trimmed.length > MAX_USER_TEXT_LENGTH) {
    throw new Error(`El mensaje es demasiado largo (máximo ${MAX_USER_TEXT_LENGTH} caracteres).`);
  }
  return trimmed;
}

/** Mensaje de texto normal */
export async function sendMessage(userText: string): Promise<PetResponse> {
  return callGemini([{ text: assertValidUserText(userText) }]);
}

/** Mensaje de texto + captura de pantalla */
export async function sendMessageWithScreenshot(
  userText: string,
  screenshotDataUrl: string
): Promise<PetResponse> {
  const base64Data = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');
  return callGemini([
    { inlineData: { mimeType: 'image/png', data: base64Data } }, 
    { text: assertValidUserText(userText) }
  ]);
}