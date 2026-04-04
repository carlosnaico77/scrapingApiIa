import type { Page } from "../../../config/config.js";
import type { HistoryGrouped, IIAProvider } from "../../../interfaces/ia.interfaces.js";
import { limpiarMarkdown } from "../../utils/funcionesGenericas.js";

export class DeepSeekProvider implements IIAProvider {

    public readonly url = process.env.URLdeepseek!;
    async consultar(page: Page, consulta: string): Promise<string> {
        const selectorRespuesta = '.ds-markdown';
        const placeholderPrincipal = 'Mensaje a DeepSeek';
        const placeholderAlt = 'Message DeepSeek';

        try {
            const inputChat = page.getByPlaceholder(placeholderPrincipal).or(page.getByPlaceholder(placeholderAlt));
            await inputChat.waitFor({ state: 'visible', timeout: 10000 });

            const ultimoAntes = page.locator(selectorRespuesta).last();
            let contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            await inputChat.fill(consulta);
            await page.keyboard.press('Enter');


            await page.waitForFunction((args) => {
                const msgs = document.querySelectorAll(args.sel);
                const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                return last !== args.old && last.length > 0;
            }, { sel: selectorRespuesta, old: contenidoViejo }, { timeout: 45000 });


            const respuestaLocator = page.locator(selectorRespuesta).last();
            let textoActual = await respuestaLocator.innerText();
            let textoAnterior = "";
            while (textoActual !== textoAnterior || textoActual === "") {
                textoAnterior = textoActual;
                await page.waitForTimeout(1500);
                textoActual = await respuestaLocator.innerText();
            }

            return await limpiarMarkdown(respuestaLocator);
        } catch (err) {
            await page.reload();
            throw err;
        }
    }

    async extraerHistorial(page: Page): Promise<HistoryGrouped> {
        return {};
    }
}

