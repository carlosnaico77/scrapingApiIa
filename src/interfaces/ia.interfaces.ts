import type { Page } from "playwright";


export interface ConversationData {
    id: string;
    title: string;
    url: string;
    listGroup: number;
}


export type HistoryGrouped = Record<number, ConversationData[]>;


export type IAProviderName = "DeepSeek" | "Gemini";



export interface IConsultaResultado {
    respuesta: string;
    id: string | undefined;
    titulo: string;
}

export interface IIAProvider {
    url: string;
    consultar(page: Page, consulta: string, idConversacion?: string): Promise<IConsultaResultado>;
    extraerHistorial(page: Page): Promise<HistoryGrouped>;
}