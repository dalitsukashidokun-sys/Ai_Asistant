import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from './ipc-channels.js';
import type { PetResponse, StartupStatus } from '../src/types/pet.js';

/**
 * Envuelve ipcRenderer.on en una suscripción con función de limpieza. Sin
 * la limpieza, un StrictMode de React (que monta/desmonta efectos dos
 * veces en desarrollo) o un simple remount del componente iría acumulando
 * listeners duplicados en el proceso principal cada vez.
 */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/**
 * Superficie mínima expuesta al renderer. Nunca exponemos `ipcRenderer`
 * completo ni la API key aquí: el renderer solo puede pedir "manda este
 * texto" (o suscribirse a un par de eventos) y recibir la respuesta ya
 * resuelta por el proceso principal.
 */
const electronAPI = {
  chat: (userText: string): Promise<PetResponse> => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, userText),

  chatWithScreen: (userText: string): Promise<PetResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND_WITH_SCREEN, userText),

  resetConversation: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.RESET_CONVERSATION),

  onConversationReset: (callback: (payload: PetResponse) => void): (() => void) =>
    subscribe(IPC_CHANNELS.CONVERSATION_RESET_BROADCAST, callback),

  onStartupStatus: (callback: (payload: StartupStatus) => void): (() => void) =>
    subscribe(IPC_CHANNELS.STARTUP_STATUS, callback),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
