export interface conversationData {
    id: string;
    title: string;
    url: string;
    listGroup: number;
}

export interface IAConfig {
    url: string | undefined;
    selectorInput: "placeholder" | "label" | "selector";
    valorSelector: string;
    altValorSelector: string;
    selectorRespuesta: string;
}