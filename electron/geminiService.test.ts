import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-key-not-real';
process.env.GEMINI_REQUEST_TIMEOUT_MS = '80'; // corto a propósito: probamos el mecanismo

/**
 * geminiService.ts llama a `fetch` (global, la del SDK de @google/genai)
 * para hablar con la API real. Sustituimos el fetch global por un doble.
 */
type FetchArgs = [url: string, init: RequestInit | undefined];
type MockHandler = (...args: FetchArgs) => Response | Promise<Response>;

let mockHandler: MockHandler = () => {
  throw new Error('Test no configuró mockHandler');
};
const calls: Array<{ url: string; body: any }> = [];

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(init.body as string) : undefined;
  calls.push({ url: String(url), body });
  return mockHandler(String(url), init);
}) as typeof fetch;

after(() => {
  globalThis.fetch = realFetch;
});

function jsonResponse(petJson: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(petJson) }] } }] }),
    { status, headers: { 'content-type': 'application/json' } }
  );
}

function fencedJsonResponse(petJson: unknown): Response {
  const fenced = '```json\n' + JSON.stringify(petJson) + '\n```';
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: fenced }] } }] }),
    { status: 200 }
  );
}

const { sendMessage, sendMessageWithScreenshot, resetConversation } = await import('./geminiService.js');

beforeEach(() => {
  calls.length = 0;
  resetConversation();
});

test('sendMessage devuelve array de segmentos para una respuesta válida', async () => {
  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'Hola, viajero.', emocion: 'feliz' }],
    });
  const res = await sendMessage('Hola');
  assert.equal(res.segmentos.length, 1);
  assert.equal(res.segmentos[0].texto, 'Hola, viajero.');
  assert.equal(res.segmentos[0].emocion, 'feliz');
  assert.equal(calls.length, 1);
});

test('el historial se acumula y se reenvía en la siguiente llamada', async () => {
  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'Primera respuesta', emocion: 'neutral' }],
    });
  await sendMessage('Primer mensaje');

  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'Segunda respuesta', emocion: 'atenta' }],
    });
  await sendMessage('Segundo mensaje');

  // user1 + model1 + user2 = 3 entradas en la segunda petición.
  assert.equal(calls[1].body.contents.length, 3);
  assert.equal(calls[1].body.contents[1].parts[0].text, 'Primera respuesta');
});

test('resetConversation() vacía el historial antes de la siguiente llamada', async () => {
  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'A', emocion: 'neutral' }],
    });
  await sendMessage('uno');

  resetConversation();

  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'B', emocion: 'neutral' }],
    });
  await sendMessage('dos');

  assert.equal(calls[1].body.contents.length, 1);
});

test('un turno que falla no queda "colgado" en el historial', async () => {
  mockHandler = () => new Response('boom', { status: 500 });
  await assert.rejects(() => sendMessage('esto va a fallar'));

  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'ok', emocion: 'neutral' }],
    });
  await sendMessage('este sí debería ir limpio');

  assert.equal(calls[1].body.contents.length, 1);
});

test('una emoción fuera del enum es rechazada por Zod', async () => {
  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'x', emocion: 'furiosa' }],
    });
  await assert.rejects(() => sendMessage('hola'));
});

test('acepta JSON envuelto en fences ```json', async () => {
  mockHandler = () =>
    fencedJsonResponse({
      segmentos: [{ texto: 'ok', emocion: 'neutral' }],
    });
  const res = await sendMessage('hola');
  assert.equal(res.segmentos[0].texto, 'ok');
});

test('un mensaje vacío se rechaza sin llegar a llamar a fetch', async () => {
  await assert.rejects(() => sendMessage('   '));
  assert.equal(calls.length, 0);
});

test('un mensaje demasiado largo se rechaza sin llamar a fetch', async () => {
  await assert.rejects(() => sendMessage('x'.repeat(5000)));
  assert.equal(calls.length, 0);
});

test('el historial se recorta y conserva la alternancia user/model', async () => {
  mockHandler = () =>
    jsonResponse({
      segmentos: [{ texto: 'r', emocion: 'neutral' }],
    });
  for (let i = 0; i < 25; i++) {
    await sendMessage(`mensaje ${i}`);
  }
  const lastBody = calls[calls.length - 1].body;
  assert.ok(lastBody.contents.length <= 41, `esperaba <=41, fue ${lastBody.contents.length}`);
  assert.equal(lastBody.contents[0].role, 'user');
});

test('sendMessageWithScreenshot incluye la parte de imagen junto al texto', async () => {
  mockHandler = (_url, init) => {
    const body = JSON.parse(init!.body as string);
    const parts = body.contents.at(-1).parts;
    assert.ok(parts.some((p: any) => p.inlineData?.mimeType === 'image/png'));
    assert.ok(parts.some((p: any) => p.text === '¿qué ves?'));
    return jsonResponse({
      segmentos: [{ texto: 'veo tu pantalla', emocion: 'atenta' }],
    });
  };
  const res = await sendMessageWithScreenshot('¿qué ves?', 'data:image/png;base64,AAAA');
  assert.equal(res.segmentos[0].emocion, 'atenta');
});

test('un error 429 de cuota devuelve un mensaje amigable en segmentos en vez de crash', async () => {
  mockHandler = () =>
    new Response(JSON.stringify({ error: { message: 'RESOURCE_EXHAUSTED' } }), { status: 429 });
  const res = await sendMessage('hola');
  assert.equal(res.segmentos[0].emocion, 'triste');
  assert.ok(res.segmentos[0].texto.includes('límite'));
});

test('una petición que nunca responde se corta por timeout', async () => {
  mockHandler = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });

  await assert.rejects(() => sendMessage('hola'), /tardado demasiado/i);
});