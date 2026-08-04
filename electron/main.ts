import { app, BrowserWindow, Tray, Menu, ipcMain, desktopCapturer, nativeImage, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { IPC_CHANNELS } from './ipc-channels.js';
import { sendMessage, sendMessageWithScreenshot, resetConversation } from './geminiService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// vite-plugin-electron inyecta esta variable solo en `npm run dev`.
// En producción (build empaquetado) no existe y cargamos el index.html generado.
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

const PET_WIDTH = 260;
const PET_HEIGHT = 340;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

// --- Instancia única -------------------------------------------------
// Sin esto, abrir la app dos veces (p. ej. doble clic accidental en el
// ejecutable, o `npm run dev` ya corriendo + otro arranque) crea dos
// mascotas independientes compitiendo por la bandeja del sistema y
// haciendo llamadas duplicadas a la API. La segunda instancia se cierra
// sola y en su lugar mostramos/enfocamos la primera.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  startApp();
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: width - PET_WIDTH - 40,
    y: height - PET_HEIGHT - 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 'screen-saver' hace que se mantenga por encima incluso de apps en
  // pantalla completa en macOS; en Windows/Linux alwaysOnTop ya basta.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Aviso de arranque: si falta la API key, el usuario se entera al
  // instante (en el propio globo de diálogo) en vez de escribirle algo al
  // personaje y solo entonces descubrir, por un error genérico, que nunca
  // configuró la clave.
  win.webContents.once('did-finish-load', sendStartupStatus);

  win.on('closed', () => {
    win = null;
  });
}

function sendStartupStatus() {
  if (!win) return;
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  win.webContents.send(IPC_CHANNELS.STARTUP_STATUS, {
    ok: hasApiKey,
    message: hasApiKey
      ? undefined
      : 'Falta GEMINI_API_KEY. Copia .env.example a .env, añade tu clave de aistudio.google.com/apikey y reinicia la app.',
  });
}

/** Compartido entre el botón de la UI y el menú de la bandeja: una única fuente de verdad para "olvidar" al personaje. */
function resetConversationAndNotify() {
  resetConversation();
  win?.webContents.send(IPC_CHANNELS.CONVERSATION_RESET_BROADCAST, {
    dialogo: '(Nueva conversación — cuéntame quién soy)',
    emocion: 'neutral',
  });
}

function createTray() {
  // Ruta relativa válida mientras la app corra desde este checkout (dev o
  // `npm run build` + ejecución local), que es el caso de uso de esta
  // entrega. Si en el futuro empaquetas con electron-builder para distribuir
  // un instalador, mueve el icono a `extraResources` y resuelve la ruta
  // con `process.resourcesPath` en vez de con `__dirname`.
  const iconPath = path.join(__dirname, '../src/assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  if (icon.isEmpty()) {
    // nativeImage no lanza error si la ruta no existe: simplemente devuelve
    // una imagen vacía y el icono de la bandeja se ve en blanco sin ninguna
    // pista de por qué. Lo dejamos explícito en consola para no perder
    // media hora de depuración el día que alguien mueva ese PNG.
    console.warn(`[mascota-ia] No se encontró el icono de la bandeja en: ${iconPath}`);
  }

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar / ocultar mascota',
      click: () => {
        if (!win) return;
        win.isVisible() ? win.hide() : win.show();
      },
    },
    { label: 'Reiniciar conversación', click: resetConversationAndNotify },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]);

  tray.setToolTip('Mascota IA');
  tray.setContextMenu(contextMenu);
  // Clic simple = alternar visibilidad, sin tener que abrir el menú
  tray.on('click', () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (_event, userText: string) => {
    return sendMessage(userText);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_SEND_WITH_SCREEN, async (_event, userText: string) => {
    // thumbnailSize grande = más nitidez para que Gemini "vea" mejor la
    // pantalla, a costa de más tokens de imagen. 1280x800 es un compromiso
    // razonable; súbelo si necesitas leer texto pequeño en pantalla.
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 800 },
    });

    const primaryScreen = sources[0];
    if (!primaryScreen) {
      // En macOS la causa casi siempre es que falta el permiso de
      // "Grabación de pantalla" en Ajustes del Sistema > Privacidad; en
      // Windows/Linux es mucho más raro no obtener ninguna fuente.
      throw new Error(
        'No se pudo capturar la pantalla. En macOS, comprueba el permiso de "Grabación de pantalla" en Ajustes del Sistema.'
      );
    }

    const screenshotDataUrl = primaryScreen.thumbnail.toDataURL();
    return sendMessageWithScreenshot(userText, screenshotDataUrl);
  });

  ipcMain.handle(IPC_CHANNELS.RESET_CONVERSATION, () => {
    resetConversationAndNotify();
  });
}

function startApp() {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    registerIpcHandlers();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // A propósito NO llamamos a app.quit() aquí: al cerrar la ventana, la
  // mascota debe seguir viva en la bandeja del sistema hasta que el usuario
  // pulse "Salir" explícitamente.
  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') return;
  });
}
