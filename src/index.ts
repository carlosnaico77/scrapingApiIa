import "./config/config.js";
import { ScrapingService } from "./Services/scraping/ScrapingService.js";
import { RouterApiIa } from "./server/routes/routerApiIa.js";
import { Server } from "./server/server.js";


const service = new ScrapingService();
const routes = new RouterApiIa(service);
const app = new Server(service, routes);

app.start();