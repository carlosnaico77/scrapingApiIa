import { chromium, path, rootRaiz, type Page, type BrowserContext } from "../../config/config.js";

export class scrapingApiIa {
    private page!: Page;
    private context!: BrowserContext;
    private initialized: boolean = false;

    async iniciarPlaywright() {
        if (this.initialized) return;

        try {
            const userPath = path.join(rootRaiz, "auth");
            this.context = await chromium.launchPersistentContext(userPath, {
                headless: true,
                channel: "chrome",
                args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
                viewport: { width: 1280, height: 720 }
            });

            this.page = this.context.pages()[0] || await this.context.newPage();
            await this.page.goto(process.env.URLdeepseek!);
            this.initialized = true;
            console.log(`[System] Navegador persistente listo.`);
        } catch (err) {
            console.error(`Error al iniciar navegador:`, err);
            this.initialized = false;
            throw err;
        }
    }

    async consultarIadeepseek(consulta: string) {
        try {
            await this.iniciarPlaywright();
            return await this.ejecutarConsulta(consulta);
        } catch (err) {
            console.error("Error en flujo:", err);
            return "Error al procesar la consulta.";
        }
    }

    private async ejecutarConsulta(consulta: string) {
        try {
            const inputChat = this.page.getByPlaceholder('Mensaje a DeepSeek').or(this.page.getByPlaceholder("Message DeepSeek"));
            await inputChat.waitFor({ state: 'visible', timeout: 10000 });

            const selector = '.ds-markdown';
            const ultimoAntes = this.page.locator(selector).last();
            let contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            await inputChat.fill(consulta);
            await this.page.keyboard.press('Enter');

            const respuestaLocator = this.page.locator(selector).last();

            await this.page.waitForFunction((args) => {
                const msgs = document.querySelectorAll(args.sel);
                const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                return last !== args.old && last.length > 0;
            }, { sel: selector, old: contenidoViejo }, { timeout: 40000 });

            let textoActual = await respuestaLocator.innerText();
            let textoAnterior = "";
            while (textoActual !== textoAnterior || textoActual === "") {
                textoAnterior = textoActual;
                await this.page.waitForTimeout(1000);
                textoActual = await respuestaLocator.innerText();
            }
            return textoActual;
        } catch (err) {
            await this.page.reload();
            throw err;
        }
    }
}