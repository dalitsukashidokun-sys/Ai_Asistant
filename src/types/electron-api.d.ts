import type { PetResponse, StartupStatus } from './pet';

export interface ElectronAPI {
  chat: (userText: string) => Promise<PetResponse>;
  chatWithScreen: (userText: string) => Promise<PetResponse>;
  resetConversation: () => Promise<void>;
  /** Se dispara cuando main reinicia la conversación (desde la UI o desde la bandeja). Devuelve una función para darse de baja. */
  onConversationReset: (callback: (payload: PetResponse) => void) => () => void;
  /** Se dispara una vez, justo después de cargar la ventana, con el estado de configuración (p. ej. si falta la API key). */
  onStartupStatus: (callback: (payload: StartupStatus) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
