import type { Page } from "../../../config/config.js";
import { limpiarMarkdown } from "../../utils/funcionesGenericas.js";
import type { IIAProvider, HistoryGrouped } from "../../../interfaces/ia.interfaces.js";
import { TIMEOUTS } from "../../../config/timeouts.js";

// Selectores centralizados — fácil de actualizar si Gemini cambia su UI
const SELECTORES = {
    respuesta: '.markdown',
    contenedorSidebar: '.sidenav-with-history-container',
    botonMenu: 'button[data-test-id="side-nav-menu-button"]',
    listaConversaciones: 'div[id^="conversations-list-"]',
    itemConversacion: '.conversation-items-container',
    linkConversacion: 'a[data-test-id="conversation"]',
    tituloConversacion: '.conversation-title',
} as const;

const LABELS = {
    principal: 'Introduce una petición para Gemini',
    alternativo: 'Pregunta a Gemini',
} as const;

export class GeminiProvider implements IIAProvider {
    public readonly url = process.env.URLGEMINI!;

    async validarSelectores(page: Page): Promise<void> {
        const criticos: Array<{ nombre: string; selector: string }> = [
            { nombre: 'respuesta', selector: SELECTORES.respuesta },
            { nombre: 'listaConversaciones', selector: SELECTORES.listaConversaciones },
        ];
        const faltantes = await Promise.all(
            criticos.map(async ({ nombre, selector }) => {
                const count = await page.locator(selector).count();
                return count === 0 ? `${nombre} ("${selector}")` : null;
            })
        );
        const problemas = faltantes.filter(Boolean);
        if (problemas.length > 0) {
            console.warn(`[GeminiProvider] Selectores no encontrados: ${problemas.join(', ')}`);
        }
    }

    async consultar(page: Page, consulta: string, idConversacion?: string): Promise<{ texto: string, id: string, titulo: string }> {
        try {

            if (idConversacion && idConversacion.trim() !== "") {
                const urlDestino = `${this.url}/chat/${idConversacion}`;
                if (!page.url().includes(idConversacion)) {
                    await page.goto(urlDestino, { waitUntil: 'networkidle' });
                }
            } else {

                if (page.url().includes('/chat/')) {
                    await page.goto(`${this.url}/`, { waitUntil: 'networkidle' });
                }
            }
            const inputChat = page
                .getByLabel(LABELS.principal)
                .or(page.getByLabel(LABELS.alternativo));
            await inputChat.waitFor({ state: 'visible', timeout: TIMEOUTS.esperarInput });

            const ultimoAntes = page.locator(SELECTORES.respuesta).last();
            const contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            await inputChat.fill(consulta);
            await page.keyboard.press('Enter');

            // Esperar que aparezca una respuesta nueva (distinta al mensaje anterior)
            await page.waitForFunction(
                (args: { sel: string; old: string }) => {
                    const msgs = document.querySelectorAll(args.sel);
                    const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                    return last !== args.old && last.length > 0;
                },
                { sel: SELECTORES.respuesta, old: contenidoViejo },
                { timeout: TIMEOUTS.esperarRespuesta }
            );

            // Esperar que el texto deje de cambiar (streaming finalizado)
            await page.waitForFunction(
                (args: { sel: string; stableMs: number }) =>
                    new Promise<boolean>((resolve) => {
                        const els = document.querySelectorAll(args.sel);
                        const last = els[els.length - 1] as HTMLElement | undefined;
                        if (!last?.innerText) { resolve(false); return; }
                        const snapshot = last.innerText;
                        setTimeout(() => resolve(last.innerText === snapshot), args.stableMs);
                    }),
                { sel: SELECTORES.respuesta, stableMs: TIMEOUTS.estabilizarTexto },
                { timeout: TIMEOUTS.esperarRespuesta }
            );

            const textoFinal = await limpiarMarkdown(page.locator(SELECTORES.respuesta).last());
            const urlActual = page.url();
            const nuevoId = urlActual.split('/').pop()?.split('?')[0] || "";

            // Intentamos sacar el título del sidebar o de la URL
            const titulo = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                // Cambiamos el fallback a "Chat de Gemini"
                return el ? (el as HTMLElement).innerText.split('\n')[0] : "Chat de Gemini";
            }, SELECTORES.tituloConversacion).catch(() => "Chat de Gemini");

            return {
                texto: textoFinal,
                id: nuevoId ?? "",
                titulo: titulo ?? "Chat sin título"
            };

        } catch (err) {
            await page.reload();
            throw err;
        }
    }

    async extraerHistorial(page: Page): Promise<HistoryGrouped> {
        try {
            const estaCerrado = await page.evaluate((sel: string) => {
                const contenedor = document.querySelector(sel);
                return contenedor ? contenedor.classList.contains('collapsed') : false;
            }, SELECTORES.contenedorSidebar);

            if (estaCerrado) {
                await page.click(SELECTORES.botonMenu);
                await page.waitForSelector(`${SELECTORES.contenedorSidebar}.expanded`);
            }

            await page.waitForSelector(SELECTORES.listaConversaciones, { timeout: TIMEOUTS.historial });

            return await page.locator(SELECTORES.listaConversaciones).evaluateAll((listNodes) => {
                const agrupado: Record<number, Array<{ id: string; title: string; url: string; listGroup: number }>> = {};
                listNodes.forEach((listNode) => {
                    const listNumber = parseInt(listNode.id.split('-').pop() ?? '0');
                    listNode.querySelectorAll('.conversation-items-container').forEach((node) => {
                        const link = node.querySelector('a[data-test-id="conversation"]') as HTMLAnchorElement | null;
                        const titleEl = node.querySelector('.conversation-title') as HTMLElement | null;
                        const href = link?.getAttribute('href') ?? '';
                        const idMatch = href.match(/\/app\/([a-zA-Z0-9]+)/);
                        (agrupado[listNumber] ??= []).push({
                            id: idMatch ? idMatch[1] ?? '' : '',
                            title: titleEl?.innerText.replace(/\s+/g, ' ').trim() ?? 'Sin título',
                            url: href,
                            listGroup: listNumber,
                        });
                    });
                });
                return agrupado;
            });
        } catch {
            return {};
        }
    }
}
