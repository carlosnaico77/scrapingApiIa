import "./config/config.js";
import { scrapingApiIa } from "./Services/scrapingApiIa/scrapingApiIa.js";
import { routerApiIa } from "./server/routes/routerApiIa.js";
import { server } from "./server/server.js";

const bot = new scrapingApiIa();
const rutas = new routerApiIa(bot);
const miServidor = new server(bot, rutas);

miServidor.inicialitServer();

