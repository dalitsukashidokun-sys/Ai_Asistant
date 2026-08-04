// api/chat.ts
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { PetResponseSchema } from '../src/types/pet.js';

const MODEL_NAME = 'gemini-3.5-flash-lite';

const SYSTEM_INSTRUCTION = `
Eres el motor narrativo de una mascota virtual para roleplay.
Divide tu réplica en una lista de 'segmentos' para paginar la conversación estilo novela visual.
Cada fragmento de 'texto' debe ser breve (máximo 60-70 caracteres por escena).
Selecciona la 'emocion' concreta que expresa el personaje en cada 'texto' específico.
El campo 'texto' es SOLO la voz hablada: nunca incluyas asteriscos ni acotaciones.
`.trim();

const { $schema: _omit, ...responseJsonSchema } = PetResponseSchema.toJSONSchema();

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en Vercel' }), { status: 500 });
    }

    const { userText } = await request.json();
    if (!userText || typeof userText !== 'string') {
      return new Response(JSON.stringify({ error: 'Texto no válido' }), { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const rawText = response.text ?? '{}';
    const parsed = PetResponseSchema.parse(JSON.parse(rawText));

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        segmentos: [
          { texto: "Niko, ha ocurrido un problema al conectarme.", emocion: "triste" }
        ]
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}