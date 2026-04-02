import { compression, express, helmet, morgan, queue } from "../config/config.js"
import { routerApiIa } from "./routes/routerApiIa.js";

const routerApi = new routerApiIa()

export class server {

    private app = express();
    private port = process.env.PORT

    private middlewares(): void {
        this.app.use(morgan("dev"));
        this.app.use(express.json());
        this.app.use(helmet());
        this.app.use(compression());
    }

    private routerApiIa() {
        const servidorEnFila = queue({ activeLimit: 1, queuedLimit: -1 });
        this.app.use("/api", servidorEnFila, routerApi.router);
        
    }

    inicialitServer() {
        this.middlewares()
        this.routerApiIa()
        this.app.listen(this.port, () => {
            console.log(`HTTP escuchando en http://localhost:${this.port}/`)
        })
    }
}