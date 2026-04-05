/**
 * Timeouts centralizados para todos los providers.
 * Modificar aquí afecta a todo el sistema.
 */
export const TIMEOUTS = {
    /** Esperar que el input del chat sea visible */
    esperarInput: 10_000,
    /** Esperar que aparezca la primera respuesta de la IA */
    esperarRespuesta: 45_000,
    /** Intervalo para confirmar que el texto dejó de cambiar (streaming terminado) */
    estabilizarTexto: 1_500,
    /** Esperar el contenedor del historial de conversaciones */
    historial: 7_000,
    /** Esperar que el panel/sidebar se abra */
    sidebar: 5_000,
} as const;
