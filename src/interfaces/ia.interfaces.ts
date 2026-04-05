import type { Page } from "playwright";


export interface ConversationData {
    id: string;
    title: string;
    url: string;
    listGroup: number;
}


export type HistoryGrouped = Record<number, ConversationData[]>;


export type IAProviderName = "DeepSeek" | "Gemini";



export interface IIAProvider {
    url: string;
    consultar(page: Page, consulta: string): Promise<string>;
    extraerHistorial(page: Page): Promise<HistoryGrouped>;
    /** Verifica en consola si los selectores CSS críticos están presentes en la página */
    validarSelectores(page: Page): Promise<void>;
}