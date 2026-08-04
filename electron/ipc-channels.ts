/**
 * Nombres de canal IPC centralizados. Se importan tanto desde main.ts
 * (donde se registran los handlers) como desde preload.ts (donde se
 * exponen al renderer), para que nunca queden desincronizados.
 */
export const IPC_CHANNELS = {
  /** Renderer -> Main: enviar un mensaje de texto al personaje */
  CHAT_SEND: 'gemini:chat-send',
  /** Renderer -> Main: enviar texto + captura de pantalla actual (visión) */
  CHAT_SEND_WITH_SCREEN: 'gemini:chat-send-with-screen',
  /** Renderer -> Main: olvidar la conversación actual (cambiar de personaje) */
  RESET_CONVERSATION: 'gemini:reset-conversation',

  /**
   * Main -> Renderer (push, sin invoke): eventos que el proceso principal
   * inicia por su cuenta, no como respuesta a una petición del renderer.
   * Se usan porque el reset también puede venir del menú de la bandeja,
   * no solo de un botón en la ventana.
   */
  CONVERSATION_RESET_BROADCAST: 'pet:conversation-reset',
  STARTUP_STATUS: 'pet:startup-status',
} as const;
