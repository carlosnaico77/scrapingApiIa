import { Router } from "../../config/config.js";
import { ScrapingService } from "../../Services/scraping/ScrapingService.js";
import type { IAProviderName } from "../../interfaces/ia.interfaces.js";

export class RouterApiIa {

    public router = Router();

    constructor(private service: ScrapingService) { this.init(); }

    private init() {
        
        this.router.post("/consultar", async (req, res) => {
            try {
                const { agente, consulta }: { agente: string, consulta: string } = req.body;

                if (!agente || !consulta) {
                    return res.status(400).json({ error: "Faltan datos" });
                }

                const nombre = agente.charAt(0).toUpperCase() + agente.slice(1).toLowerCase();
                const final = (nombre === "Deepseek" ? "DeepSeek" : nombre) as IAProviderName;

                const proveedoresSoportados: IAProviderName[] = ["DeepSeek", "Gemini"];


                if (!proveedoresSoportados.includes(final)) {
                    return res.status(404).json({ error: "IA no soportada" });
                }

                const msg: string = await this.service.consultar(final, consulta);
                return res.json({ success: true, agente: final, message: msg });

            } catch (error: any) {
                return res.status(503).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.router.get("/conversaciones/:ia", async (req, res) => {
            try {
                const ia = req.params.ia;
                const nombre = ia.charAt(0).toUpperCase() + ia.slice(1).toLowerCase();
                const final = (nombre === "Deepseek" ? "DeepSeek" : nombre) as IAProviderName;

                const data = await this.service.obtenerConversaciones(final);
                const totalConversaciones = Object.values(data).reduce((acc: number, grupo: any) => acc + (grupo.length || 0), 0);
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