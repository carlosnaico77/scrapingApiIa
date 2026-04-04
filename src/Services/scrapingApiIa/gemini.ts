import type { Page } from "../../config/config.js";
import type { conversationDataGemini } from "./interfaces.js";

/* En este archivo iran las funciones dirigidas a interactuar con la pagina de Gemini */

export async function extraerConversacionesGemini(page: Page): Promise<Record<number, conversationDataGemini[]>> {

    const containerSelector = 'div[id^="conversations-list-"]';

    try {
        await page.waitForSelector(containerSelector, { timeout: 7000 });

        const containers = page.locator(containerSelector);

        return await containers.evaluateAll((listNodes) => {
            // Usamos el tipo exacto para evitar errores de TS
            const agrupado: Record<number, any[]> = {};

            listNodes.forEach((listNode) => {
                // 1. Extraemos el número del bloque (0, 1, 4, etc.)
                const listId = listNode.id;
                const listNumber = parseInt(listId.split('-').pop() || '0');

                // 2. Inicializamos el array para este grupo si no existe (Adiós error ts(2532))
                if (!agrupado[listNumber]) {
                    agrupado[listNumber] = [];
                }

                // 3. Buscamos los items dentro de este contenedor específico
                const items = listNode.querySelectorAll('.conversation-items-container');

                items.forEach((node) => {
                    const link = node.querySelector('a[data-test-id="conversation"]') as HTMLAnchorElement | null;
                    const titleEl = node.querySelector('.conversation-title') as HTMLElement | null;

                    const href = link?.getAttribute('href') ?? '';
                    const idMatch = href.match(/\/app\/([a-zA-Z0-9]+)/);
                    const rawTitle = titleEl?.innerText ?? 'Sin título';
                    const cleanTitle = rawTitle.replace(/\s+/g, ' ').trim();

                    // 4. Guardamos en el grupo correspondiente
                    (agrupado[listNumber] ??= []).push({
                        id: idMatch ? idMatch[1] : '',
                        title: cleanTitle || 'Sin título',
                        url: href,
                        listGroup: listNumber
                    });
                });
            });

            return agrupado;
        });

    } catch (error) {
        console.warn('No se detectó el historial o la estructura cambió.');
        return {};
    }
}