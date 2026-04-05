import type { Page } from "playwright";


export interface ConversationData {
    id: string;
    title: string;
    url: string;
    listGroup: number;
}


export type HistoryGrouped = Record<number, ConversationData[]>;


export type IAProviderName = "DeepSeek" | "Gemini";

export interface RespuestaConsulta {
    success: boolean;
    agente: string;
    message: string;
    idConversacion: string; // El ID actual
    tituloConversacion: string; // El nombre del chat
}

export interface IIAProvider {
    url: string;
    consultar(page: Page, consulta: string, idConversacion?: string): Promise<{ texto: string; id: string; titulo: string }>;
    consultarConArchivo(page: Page, consulta: string, rutaArchivo: string, idConversacion?: string): Promise<{ texto: string; id: string; titulo: string }>;
    extraerHistorial(page: Page): Promise<HistoryGrouped>;
    validarSelectores(page: Page): Promise<void>;
}