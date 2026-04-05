import { Router } from "../../config/config.js";
import { ScrapingService } from "../../Services/scraping/ScrapingService.js";
import type { IAProviderName } from "../../interfaces/ia.interfaces.js";

const PROVEEDORES_SOPORTADOS: IAProviderName[] = ["DeepSeek", "Gemini"];

function resolverProveedor(agente: string): IAProviderName | null {
    const nombre = agente.charAt(0).toUpperCase() + agente.slice(1).toLowerCase();
    const final = nombre === "Deepseek" ? "DeepSeek" : nombre;
    return PROVEEDORES_SOPORTADOS.includes(final as IAProviderName)
        ? (final as IAProviderName)
        : null;
}

export class RouterApiIa {

    public router = Router();

    constructor(private service: ScrapingService) { this.init(); }

    private init() {

        this.router.get("/health", (_req, res) => {
            res.status(200).json({
                status: "ok",
                navegador: this.service.estaInicializado() ? "activo" : "inactivo",
                providers: PROVEEDORES_SOPORTADOS,
            });
        });

        this.router.post("/consultar", async (req, res) => {
            try {
                const { agente, consulta }: { agente: string; consulta: string } = req.body;

                if (!agente || !consulta) {
                    return res.status(400).json({ error: "Faltan datos" });
                }

                const proveedor = resolverProveedor(agente);
                if (!proveedor) {
                    return res.status(404).json({ error: "IA no soportada" });
                }

                const msg: string = await this.service.consultar(proveedor, consulta);
                return res.json({ success: true, agente: proveedor, message: msg });

            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                return res.status(503).json({ success: false, error: msg });
            }
        });

        this.router.get("/conversaciones/:ia", async (req, res) => {
            try {
                const proveedor = resolverProveedor(req.params.ia ?? "");
                if (!proveedor) {
                    return res.status(404).json({ error: "IA no soportada" });
                }

                const data = await this.service.obtenerConversaciones(proveedor);
                const total = Object.values(data).reduce((acc, grupo) => acc + grupo.length, 0);
                return res.status(200).json({ success: true, ia: proveedor, total, data });

            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                return res.status(500).json({ success: false, error: msg });
            }
        });
    }
}
