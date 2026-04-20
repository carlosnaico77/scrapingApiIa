import "./config/config.js";
import { ScrapingService } from "./Services/scraping/ScrapingService.js";
import { RouterApiIa } from "./server/routes/routerApiIa.js";
import { Server } from "./server/server.js";
import { GeminiProvider } from "./Services/scraping/providers/Gemini.js";
import { DeepSeekProvider } from "./Services/scraping/providers/DeepSeek.js";


const gemini = new GeminiProvider();
const deepseek = new DeepSeekProvider();
const service = new ScrapingService(gemini, deepseek);
const routes = new RouterApiIa(service);
const app = new Server(service, routes);

app.start();