import { Router } from "../../config/config.js";
import type { scrapingApiIa } from "../../Services/scrapingApiIa/scrapingApiIa.js";

export class routerApiIa {
    public router = Router();

    constructor(private botService: scrapingApiIa) {
        this.initializeRoutes();
    }

    private initializeRoutes() {

        this.router.post("/consultar", async (req, res) => {
            try {
                let { agente, consulta } = req.body;
                if (!agente || !consulta || consulta.trim() === "") {
                    return res.status(400).json({
                        success: false,
                        message: "Faltan datos: 'agente' y 'consulta' (no vacía) son obligatorios."
                    });
                }
                const agenteNormalizado = agente.charAt(0).toUpperCase() + agente.slice(1).toLowerCase();
                const agenteFinal = agenteNormalizado === "Deepseek" ? "DeepSeek" : agenteNormalizado;
                if (agenteFinal === "DeepSeek" || agenteFinal === "Gemini") {
                    const respuesta = await this.botService.consultarIa(agenteFinal as "DeepSeek" | "Gemini", consulta.trim());
                    return res.status(200).json({
                        success: true,
                        agente: agenteFinal,
                        message: respuesta
                    });
                }
                return res.status(404).json({
                    success: false,
                    message: `Agente '${agente}' no soportado.`
                });

            } catch (error) {
                console.error("Error en /consultar:", error);
                return res.status(500).json({
                    success: false,
                    error: "Error interno del servidor"
                });
            }
        });


        this.router.get("/conversaciones/:ia", async (req, res) => {

            const iaParam = req.params.ia;
            const iaNormalizada = iaParam.charAt(0).toUpperCase() + iaParam.slice(1).toLowerCase();
            const iaFinal = iaNormalizada === "Deepseek" ? "DeepSeek" : iaNormalizada;
            if (iaFinal !== "Gemini" && iaFinal !== "DeepSeek") {
                return res.status(400).json({
                    success: false,
                    message: "IA no soportada. Use Gemini o DeepSeek."
                });
            }
            try {
                const data = await this.botService.obtenerListaConversaciones(iaNormalizada as "Gemini" | "DeepSeek");
                return res.status(200).json({
                    success: true,
                    ia: iaNormalizada,
                    data: data
                });
            } catch (error: any) {
                return res.status(500).json({ success: false, error: error.message });
            }
        });
    }
}