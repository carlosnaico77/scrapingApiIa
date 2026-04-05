import { express, helmet, morgan, compression, queue } from "../config/config.js";
import { ScrapingService } from "../Services/scraping/ScrapingService.js";
import { RouterApiIa } from "./routes/routerApiIa.js";


export class Server {
    private app = express();
    constructor(private service: ScrapingService, private routes: RouterApiIa) { }

    async start() {
        this.app.use(morgan("dev"), express.json(), helmet(), compression());
        this.app.use("/api", queue({ activeLimit: 1 }), this.routes.router);

        const port = process.env.PORT || 3500;

        try {

            console.log("[System] Iniciando navegador, por favor espera...");
            await this.service.iniciar();

            this.app.listen(port, () => {
                console.log(`[OK] Servidor listo en http://localhost:${port}`);
                console.log(`[OK] Navegador listo para recibir consultas.`);
            });
        } catch (error) {
            console.error("[Error] No se pudo iniciar el navegador:", error);
            process.exit(1)
        }
    }
}