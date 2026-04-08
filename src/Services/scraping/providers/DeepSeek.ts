import type { Page } from "../../../config/config.js";
import type { HistoryGrouped, IIAProvider } from "../../../interfaces/ia.interfaces.js";
import { limpiarMarkdown } from "../../utils/funcionesGenericas.js";
import type {IConsultaResultado} from "../../../interfaces/ia.interfaces.js"

export class DeepSeekProvider implements IIAProvider {

    public readonly url = process.env.URLdeepseek!;

    async consultar(page: Page, consulta: string, idConversacion?: string): Promise<IConsultaResultado> {
        
        const selectorRespuesta = '.ds-markdown';
        const placeholderPrincipal = 'Mensaje a DeepSeek';
        const placeholderAlt = 'Message DeepSeek';
        
        try {

             if (idConversacion && idConversacion.trim() !== "") {
                
                const urlDestino = `${this.url}/a/chat/s/${idConversacion}`;

                if (!page.url().includes(idConversacion)) {
                    await page.goto(urlDestino, { waitUntil: 'domcontentloaded' });
                }
            } else {
                // Para chat nuevo, la raíz suele ser suficiente
                if (page.url().includes('/chat/')) {
                    await page.goto(`${this.url}/`, { waitUntil: 'domcontentloaded' });
                }
            }
            
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

            const cleanRespuesta = await limpiarMarkdown(respuestaLocator);

            // Extracción de ID y Título
            const finalUrl = page.url();
            const idFinal = finalUrl.split('/').pop() || (idConversacion || "");
            
            let tituloFinal = "Sin título";
            try {
                if (!idConversacion) await page.waitForTimeout(2000);
                const chatLink = page.locator(`a[href*="${idFinal}"]`).first();
                if (await chatLink.count() > 0) {
                    const fullText = await chatLink.innerText();
                    tituloFinal = fullText.split('\n')[0]?.trim() || "Sin título";
                }
            } catch (e) {
                 console.error("[DeepSeek] No se pudo extraer el título");
            }

            return {
                respuesta: cleanRespuesta,
                id: idFinal,
                titulo: tituloFinal
            };

        } catch (err) {
            await page.reload();
            throw err;
        }
    }

    async extraerHistorial(page: Page): Promise<HistoryGrouped> {
        
        const selectorItemChat = 'a[href*="/chat/"]';
        const selectorPanel = '.b8812f16'; // El contenedor que subiste en el HTML
        const selectorBotonAbrir = '.ds-icon-button';

        try {
            
            const panel = page.locator(selectorPanel);
            const estaCerrado = !(await panel.isVisible());

            if (estaCerrado) {
                const btnAbrir = page.locator(selectorBotonAbrir).first();
                if (await btnAbrir.count() > 0) {
                    await btnAbrir.click();
                    await page.waitForSelector(selectorItemChat, { state: 'attached', timeout: 5000 });
                }
            }

           
            const chats = await page.evaluate((sel) => {
                const results: any[] = [];
                const elements = document.querySelectorAll(sel);

                elements.forEach((el, index) => {
                    if (el instanceof HTMLElement) {
                        const href = el.getAttribute('href') || '';
                        
                        const fullText = el.innerText || '';
                        const cleanTitle = fullText.split('\n')[0]?.trim() || 'Sin título';

                        results.push({
                            id: href.split('/').pop() || `ds-${index}`,
                            title: cleanTitle || 'Sin título',
                            url: href
                        });
                    }
                });
                return results;
            }, selectorItemChat);

           
            const final: HistoryGrouped = { 0: [] };
            chats.forEach(chat => {
                (final[0] ??= []).push({
                    ...chat,
                    listGroup: 0
                });
            });

            return final;

        } catch (error: any) {
            console.error(`[DeepSeekProvider] Error al extraer historial:`, error.message);
            return { 0: [] };
        }
    }
}

