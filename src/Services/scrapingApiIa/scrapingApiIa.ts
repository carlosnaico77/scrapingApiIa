import { chromium, path, rootRaiz, type Page, type BrowserContext } from "../../config/config.js";
import { limpiarMarkdown } from "./funcionesGenericas.js";
import { extraerConversacionesGemini } from "./gemini.js";
import type { conversationDataGemini } from "./interfaces.js";


export class scrapingApiIa {

    private pages: Record<string, Page> = {};
    private context!: BrowserContext;
    private initialized: boolean = false;

    private configIA = {
        "DeepSeek": {
            url: process.env.URLdeepseek,
            selectorInput: "placeholder",
            valorSelector: 'Mensaje a DeepSeek',
            altValorSelector: 'Message DeepSeek',
            selectorRespuesta: '.ds-markdown'
        },
        "Gemini": {
            url: process.env.URLGEMINI,
            selectorInput: "label",
            valorSelector: 'Introduce una petición para Gemini',
            altValorSelector: 'Pregunta a Gemini',
            selectorRespuesta: '.markdown'
        }
    };

    async iniciarPlaywright() {
        if (this.initialized) return;

        try {
            const userPath = path.join(rootRaiz, "auth");
            this.context = await chromium.launchPersistentContext(userPath, {
                headless: false,
                channel: "chrome",
                args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
            });

            this.pages["DeepSeek"] = this.context.pages()[0] || await this.context.newPage();
            await this.pages["DeepSeek"].goto(this.configIA["DeepSeek"].url);

            this.pages["Gemini"] = await this.context.newPage();
            await this.pages["Gemini"].goto(this.configIA["Gemini"].url);

            this.initialized = true;
            console.log(`[System] Navegador persistente listo.`);
        } catch (err) {
            console.error(`Error al iniciar navegador:`, err);
            this.initialized = false;
            throw err;
        }
    }

    async consultarIa(proveedor: "DeepSeek" | "Gemini", consulta: string) {
        try {
            await this.iniciarPlaywright();
            const config = this.configIA[proveedor];
            const page = this.pages[proveedor];

            if (!page) throw new Error("Proveedor no inicializado");

            return await this.ejecutarConsultaGenerica(page, consulta, config);
        } catch (err) {
            console.error(`Error en flujo ${proveedor}:`, err);
            return `Error al procesar la consulta en ${proveedor}.`;
        }
    }

    private async ejecutarConsultaGenerica(page: Page, consulta: string, config: any) {
        try {
            let inputChat;

            if (config.selectorInput === "placeholder") {
                inputChat = page.getByPlaceholder(config.valorSelector).or(page.getByPlaceholder(config.altValorSelector));
            } else if (config.selectorInput === "label") { /* Gemini */
                inputChat = page.getByLabel(config.valorSelector).or(page.getByLabel(config.altValorSelector));

            } else {

                inputChat = page.locator(config.valorSelector);
            }

            await inputChat.waitFor({ state: 'visible', timeout: 10000 });

            const selector = config.selectorRespuesta;
            const ultimoAntes = page.locator(selector).last();
            let contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            await inputChat.fill(consulta);
            await page.keyboard.press('Enter');

            const respuestaLocator = page.locator(selector).last();

            await page.waitForFunction((args) => {
                const msgs = document.querySelectorAll(args.sel);
                const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                return last !== args.old && last.length > 0;
            }, { sel: selector, old: contenidoViejo }, { timeout: 45000 });

            let textoActual = await respuestaLocator.innerText();
            let textoAnterior = "";
            while (textoActual !== textoAnterior || textoActual === "") {
                textoAnterior = textoActual;
                await page.waitForTimeout(1000);
                textoActual = await respuestaLocator.innerText();
            }

            return await limpiarMarkdown(respuestaLocator);

        } catch (err) {
            await page.reload();
            throw err;
        }
    }

    async obtenerListaConversaciones(ia: "Gemini" | "DeepSeek"): Promise<conversationDataGemini[]> {
        try {
            await this.iniciarPlaywright();
            const page = this.pages[ia];
            if (!page) {
                console.error(`Error: La página para ${ia} no existe.`);
                return [];
            }
            if (ia === "Gemini") {
                return await extraerConversacionesGemini(page);
            }

            return []
        } catch (err) {
            console.error("Error en obtenerListaConversaciones:", err);
            return [];
        }
    }
}






