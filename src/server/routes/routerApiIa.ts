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

            try {
               
                const data = await this.botService.obtenerListaConversaciones(ia as "Gemini");

               return res.status(200).json({
                    success: true,
                    ia: ia,
                    data: data
                });
            } catch (error: any) {
                return res.status(500).json({ success: false, error: error.message });
            }
        });
    }
}