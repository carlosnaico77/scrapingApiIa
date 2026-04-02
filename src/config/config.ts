import { loadEnvFile } from 'node:process';
import { chromium, type Page, type BrowserContext , type Locator } from "playwright";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

loadEnvFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootRaiz = path.join(__dirname, "../../")

export { chromium, type Page, rootRaiz, path, type BrowserContext , type Locator};