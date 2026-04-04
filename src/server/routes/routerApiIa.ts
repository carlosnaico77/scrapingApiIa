import { Router } from "../../config/config.js";
import { ScrapingService } from "../../Services/scraping/ScrapingService.js";


export class RouterApiIa {
    public router = Router();
    constructor(private service: ScrapingService) { this.init(); }

    private init() {
        this.router.post("/consultar", async (req, res) => {
            const { agente, consulta } = req.body;
            if (!agente || !consulta) return res.status(400).json({ error: "Faltan datos" });

            const nombre = agente.charAt(0).toUpperCase() + agente.slice(1).toLowerCase();
            const final = nombre === "Deepseek" ? "DeepSeek" : nombre;

            if (final === "DeepSeek" || final === "Gemini") {
                const msg = await this.service.consultar(final as any, consulta);
                return res.json({ success: true, agente: final, message: msg });
            }
            res.status(404).json({ error: "IA no soportada" });
        });

        this.router.get("/conversaciones/:ia", async (req, res) => {
            try {
                const ia = req.params.ia;
                const nombre = ia.charAt(0).toUpperCase() + ia.slice(1).toLowerCase();
                const final = nombre === "Deepseek" ? "DeepSeek" : nombre;
                const data = await this.service.obtenerConversaciones(final as any);
                const totalConversaciones = Object.values(data).reduce(
                    (acc: number, grupo: any) => acc + (grupo.length || 0),
                    0
                );
                return res.status(200).json({
                    success: true,
                    ia: final,
                    total: totalConversaciones,
                    data: data
                });

            } catch (error: any) {
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }
}