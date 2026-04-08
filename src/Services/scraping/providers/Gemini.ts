import type { Page } from "../../../config/config.js";
import { limpiarMarkdown } from "../../utils/funcionesGenericas.js";
import type { IIAProvider, HistoryGrouped } from "../../../interfaces/ia.interfaces.js";
import type {IConsultaResultado} from "../../../interfaces/ia.interfaces.js"
export class GeminiProvider implements IIAProvider {
    public readonly url = process.env.URLGEMINI!;
    
    
    async consultar(page: Page, consulta: string, idConversacion?: string): Promise<IConsultaResultado> {
        
        const selectorRespuesta = '.markdown';
        const labelPrincipal = 'Introduce una petición para Gemini';
        const labelAlt = 'Pregunta a Gemini';

        try {

            if (idConversacion && idConversacion.trim() !== "") {
                if (!page.url().includes(idConversacion)) {
                    const baseUrl = this.url.split('?')[0];
                    const query = this.url.split('?')[1] ? `?${this.url.split('?')[1]}` : '';
                    const urlDestino = `${baseUrl}/${idConversacion}${query}`;
                    await page.goto(urlDestino, { waitUntil: 'domcontentloaded' });
                }
            } else {
                // Para chat nuevo, si la URL actual tiene un ID de conversación, volvemos a la raíz
                if (page.url().match(/\/app\/[a-zA-Z0-9]+/)) {
                    await page.goto(this.url, { waitUntil: 'domcontentloaded' });
                }
            }
            
            const inputChat = page.getByLabel(labelPrincipal).or(page.getByLabel(labelAlt));
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
            while (textoActual !== textoAnterior) {
                textoAnterior = textoActual;
                await page.waitForTimeout(1000);
                textoActual = await respuestaLocator.innerText();
            }

            const cleanRespuesta = await limpiarMarkdown(respuestaLocator);
            
            // Extracción de ID y Título
            const finalUrl = page.url();
            const idMatch = finalUrl.match(/\/app\/([a-zA-Z0-9]+)/);
            const idFinal = idMatch ? idMatch[1] : (idConversacion || "");
            
            let tituloFinal = "Sin título";
            try {
                // Esperar un momento por si la IA está generando el título (en chats nuevos)
                if (!idConversacion) await page.waitForTimeout(2000);
                
                const selectorTitulo = `a[href*="${idFinal}"] .conversation-title`;
                const tituloLocator = page.locator(selectorTitulo).first();
                if (await tituloLocator.count() > 0) {
                    tituloFinal = (await tituloLocator.innerText()).trim();
                }
            } catch (e) {
                console.error("[Gemini] No se pudo extraer el título");
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

        const selectorContenedor = '.sidenav-with-history-container';
        const selectorBotónMenu = 'button[data-test-id="side-nav-menu-button"]';
        const containerSelector = 'div[id^="conversations-list-"]';

        try {
            const estaCerrado = await page.evaluate((sel: string) => {
                const contenedor = document.querySelector(sel);
                return contenedor ? contenedor.classList.contains('collapsed') : false;
            }, selectorContenedor);

            if (estaCerrado) {
                await page.click(selectorBotónMenu);
                await page.waitForSelector(`${selectorContenedor}.expanded`);
            }

            await page.waitForSelector(containerSelector, { timeout: 7000 });
            return await page.locator(containerSelector).evaluateAll((listNodes) => {
                const agrupado: Record<number, any[]> = {};
                listNodes.forEach((listNode) => {
                    const listNumber = parseInt(listNode.id.split('-').pop() || '0');
                    const items = listNode.querySelectorAll('.conversation-items-container');
                    items.forEach((node) => {
                        const link = node.querySelector('a[data-test-id="conversation"]') as HTMLAnchorElement | null;
                        const titleEl = node.querySelector('.conversation-title') as HTMLElement | null;
                        const href = link?.getAttribute('href') ?? '';
                        const idMatch = href.match(/\/app\/([a-zA-Z0-9]+)/);

                        (agrupado[listNumber] ??= []).push({
                            id: idMatch ? idMatch[1] : '',
                            title: titleEl?.innerText.replace(/\s+/g, ' ').trim() || 'Sin título',
                            url: href,
                            listGroup: listNumber
                        });
                    });
                });
                return agrupado;
            });
        } catch (e) {
            return {};
        }
    }
}

