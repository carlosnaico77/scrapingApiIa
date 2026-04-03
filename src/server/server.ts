import { express, helmet, morgan, compression, queue } from "../config/config.js";
import type { routerApiIa } from "./routes/routerApiIa.js";
import type { scrapingApiIa } from "../Services/scrapingApiIa/scrapingApiIa.js";

export class server {
    private app = express();
    private port = process.env.PORT || 3500;

    constructor(private botService: scrapingApiIa, private routerApi: routerApiIa) { }

    private middlewares() {
        this.app.use(morgan("dev"));
        this.app.use(express.json());
        this.app.use(helmet());
        this.app.use(compression());
    }

    private setupRoutes() {
        const servidorEnFila = queue({ activeLimit: 1, queuedLimit: -1 });
        this.app.use("/api", servidorEnFila, this.routerApi.router);
    }

    async inicialitServer() {
        this.middlewares();
        this.setupRoutes();

        try {
            await this.botService.iniciarPlaywright();
            this.app.listen(this.port, () => {
                console.log(`[OK] Servidor en http://localhost:${this.port}/`);
            });
        } catch (err) {
            console.error("Fallo al iniciar:", err);
            process.exit(1);
        }
    }
}