import "./config/config.js"

import { scrapingApiIa } from "./Services/scrapingApiIa/index.js";

const scraping = new scrapingApiIa();

scraping.consultarIadeepseek("Me das un consejo rapido de 3 lineas para mejorar mi logica de progrmacion")

