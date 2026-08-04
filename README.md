# Mascota IA — Desktop Pet (Electron + React + TS + Gemini)

Mascota de escritorio interactiva: una ventana transparente, sin bordes y
siempre visible que cambia de expresión (PNG) según la emoción que Gemini
declara en cada respuesta, usando salida JSON estructurada (nada de
analizar texto libre para adivinar el sentimiento).

## Arrancar

```bash
npm install
cp .env.example .env
# Edita .env y añade tu clave gratuita de https://aistudio.google.com/apikey
npm run dev
```

Se abrirá una ventanita flotante en la esquina inferior derecha de la
pantalla. Escríbele algo (o mantén pulsado 🎙 para hablar) y responderá
en personaje, cambiando de cara según cómo se sienta.

## Scripts

- `npm run dev` — modo desarrollo (Vite + Electron con recarga en caliente).
- `npm run typecheck` — `tsc --noEmit` sobre el renderer y sobre Electron por separado.
- `npm test` — pruebas del servicio de Gemini (historial, validación, timeout) simulando la capa HTTP, sin red real ni API key real.
- `npm run build` — build de producción (`dist/` + `dist-electron/`).
- `npm run preview` — sirve el `dist/` del renderer (solo para inspeccionar el bundle web, no lanza Electron).

## Qué sustituir primero

1. **Los sprites** (`src/assets/sprites/*.png`): son placeholders generados
   por `generate_placeholders.py` para que el proyecto arranque mostrando
   algo. Sustitúyelos por tu propio arte manteniendo el mismo nombre de
   archivo (`feliz.png`, `triste.png`, etc.) y no tendrás que tocar código.
2. **El icono de la bandeja** (`src/assets/tray-icon.png`): mismo trato.
3. **El personaje** (`electron/geminiService.ts`, constante `SYSTEM_INSTRUCTION`):
   ahí defines qué personaje interpreta Gemini.
4. **El enum de emociones** (`src/types/pet.ts`): si añades o quitas una
   emoción, actualiza también el `Record` de `src/components/PetSprite.tsx`
   y añade/quita su PNG.

## Notas de arquitectura

- **Toda llamada a Gemini vive en el proceso principal**
  (`electron/geminiService.ts`), nunca en el renderer: así la API key nunca
  se expone al contexto web, aunque en esta app el renderer solo cargue
  contenido local.
- **Salida estructurada**: `responseMimeType: 'application/json'` +
  `responseJsonSchema` (generado desde el schema de Zod en `src/types/pet.ts`)
  fuerzan a Gemini a devolver siempre `{ dialogo, emocion }`. Es la parte
  más importante del proyecto: por eso no hace falta ningún análisis de
  sentimiento sobre texto libre.
- **Reconocimiento de voz** (`src/hooks/useSpeechRecognition.ts`) usa
  `webkitSpeechRecognition`, disponible de fábrica en Electron por ser
  Chromium. Requiere conexión a internet (el reconocimiento de Google es
  en la nube) y no tiene `@types` oficiales, de ahí el tipado manual.
- **Captura de pantalla** (`ipcMain.handle(IPC_CHANNELS.CHAT_SEND_WITH_SCREEN, ...)`
  en `electron/main.ts`) usa `desktopCapturer` en el proceso principal — el
  renderer nunca toca esa API directamente, solo pide "envía esto con lo
  que hay en pantalla" vía IPC.

## Pendiente para distribuir (fuera del alcance de este boilerplate)

Este proyecto está pensado para `npm run dev` / uso personal desde el
checkout. Para distribuirlo como instalador (con `electron-builder`),
la ruta del icono de la bandeja en `createTray()` tendría que resolverse
vía `extraResources` / `process.resourcesPath` en vez de una ruta relativa
al código fuente — hay un comentario marcando exactamente ese punto en
`electron/main.ts`.
