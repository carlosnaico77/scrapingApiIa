type TipoAgente = "DeepSeek" | "Gemini";

export interface PeticionIA {
    agente: TipoAgente;
    consulta: string;
}