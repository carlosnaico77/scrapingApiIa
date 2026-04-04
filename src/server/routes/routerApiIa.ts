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
                const { agente, consulta } = req.body;
                if (agente === "DeepSeek" || agente === "Gemini") {
                    const respuesta = await this.botService.consultarIa(agente, consulta);
                    return res.status(200).json({ message: respuesta });
                }
                res.status(404).json({ message: "Agente no soportado" });
            } catch (error) {
                res.status(500).json({ error: "Error interno" });
            }
        });

        this.router.get("/conversaciones/:ia", async (req, res) => {
            const { ia } = req.params;


            if (ia !== "Gemini" && ia !== "DeepSeek") {
                return res.status(400).json({
                    success: false,
                    message: "IA no soportada. Use 'Gemini' o 'DeepSeek'."
                });
            }

            try {

                const conversaciones = await this.botService.obtenerListaConversaciones(ia as "Gemini" | "DeepSeek");


                return res.status(200).json({
                    success: true,
                    ia: ia,
                    count: conversaciones.length,
                    data: conversaciones
                });

            } catch (error: any) {
                console.error(`Error al obtener conversaciones de ${ia}:`, error);
                return res.status(500).json({
                    success: false,
                    message: "Error interno al extraer el historial."
                });
            }
        });
    }
}