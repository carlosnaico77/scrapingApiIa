import { Router, type PeticionIA } from "../../config/config.js"
import { scrapingApiIa } from "../../Services/scrapingApiIa/scrapingApiIa.js"

const apiIaScraping = new scrapingApiIa();

export class routerApiIa {
    router = Router();
    constructor() {
        this.initializeRoutes()
    }
    private initializeRoutes() {
        this.router.post("/consultar", async (req, res) => {
            try {
                const { agente, consulta } = req.body as PeticionIA;


                if (!agente) {
                    return res.status(400).json({ error: "No seleccionaste ningún agente válido" });
                }
                if (!consulta) {
                    return res.status(400).json({ error: "No enviaste ninguna consulta" });
                }

                switch (agente) {
                    case "DeepSeek":

                        const respuestaApi = await apiIaScraping.consultarIadeepseek(consulta);
                        return res.status(200).json({ status: 200, message: respuestaApi });

                    default:
                        return res.status(404).json({
                            status: 404,
                            message: "En este momento no contamos con ese proveedor"
                        });
                }
            } catch (error) {
                console.error("Error en el router:", error);
                return res.status(500).json({ error: "Hubo un problema al procesar tu consulta" });
            }
        });
    }
}