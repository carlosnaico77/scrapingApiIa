import { chromium, path, rootRaiz } from "../../config/config.js";
import type { Page, BrowserContext } from "../../config/config.js"

export class scrapingApiIa {

    private page!: Page;
    private context!: BrowserContext



    async consultarIadeepseek(consulta: string) {
        try {
            await this.iniciarPlaywright()
            const respuesta = await this.consultar(consulta);
            return respuesta
        } catch (err) {
            console.error(err)
            return "Error al utilizar el servicio por favor valide con el proveedor"
        }
    }



    private async iniciarPlaywright() {
        try {
            const userPath = path.join(rootRaiz, "auth");
            this.context = await chromium.launchPersistentContext(userPath, {
                headless: true,
                channel: "chrome",
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox'
                ],
                viewport: { width: 1280, height: 720 }
            });

            this.page = this.context.pages()[0] || await this.context.newPage();
            await this.page.goto(process.env.URLdeepseek);
            console.log(`[1] Se realizó el proceso de inicio con éxito`);
        } catch (err) {
            console.error(`Error al iniciar sección Playwright:`);
            await this.cerrarSeccion()
            throw err;
        }
    }

    private async consultar(Consulta: string) {

        try {
            const inputChat = this.page.getByPlaceholder('Mensaje a DeepSeek');
            await inputChat.waitFor({ state: 'visible' });
            const selector = '.ds-markdown';
            const ultimoMensajeAntes = this.page.locator(selector).last();
            let contenidoViejo = "";
            if (await ultimoMensajeAntes.count() > 0) {
                contenidoViejo = await ultimoMensajeAntes.innerText();
            }
            await inputChat.fill(Consulta);
            await this.page.keyboard.press('Enter');
            console.log(`[2] Mensaje enviado, esperando respuesta...`);


            const respuestaLocator = this.page.locator(selector).last();

            await this.page.waitForFunction((args) => {
                const lastMsg = document.querySelectorAll(args.sel);
                const lastContent = lastMsg.length > 0 ? (lastMsg[lastMsg.length - 1] as HTMLElement).innerText : "";
                return lastContent !== args.oldContent && lastContent.length > 0;
            }, { sel: selector, oldContent: contenidoViejo }, { timeout: 30000 });


            let textoActual = await respuestaLocator.innerText();
            let textoAnterior = "";
            while (textoActual !== textoAnterior || textoActual === "") {
                textoAnterior = textoActual;
                await this.page.waitForTimeout(1000);
                textoActual = await respuestaLocator.innerText();
            }
            console.log(`[3] Respuesta recibida con exito`);
            return textoActual
        } catch (err) {
            console.error(`Error al relizar la consulta:`)
            throw err

        } finally {
            await this.cerrarSeccion()
        }
    }

    private async cerrarSeccion() {
        try {
            if (this.context) {
                await this.context.close();
                console.log("[√] Navegador y contexto cerrados correctamente.");
            }
        } catch (err) {
            console.error("Error al cerrar Playwright:");
            throw err;
        }
    }
}

