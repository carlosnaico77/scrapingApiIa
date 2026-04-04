import type { Page } from "../../config/config.js";
import type { conversationDataGemini } from "./interfaces.js";

/* En este archivo iran las funciones dirigidas a interactuar con la pagina de Gemini */

export async function extraerConversacionesGemini(page: Page): Promise<conversationDataGemini[]> {

    const containerSelector = 'div[id^="conversations-list-"]';

    try {
        await page.waitForSelector(containerSelector, { timeout: 7000 });


        const containers = page.locator(containerSelector);

        return await containers.evaluateAll((listNodes) => {
            const todasLasConversaciones: any[] = [];

            listNodes.forEach((listNode) => {

                const listId = listNode.id;
                const listNumber = listId.split('-').pop() || '0';


                const items = listNode.querySelectorAll('.conversation-items-container');

                items.forEach((node) => {
                    const link = node.querySelector('a[data-test-id="conversation"]') as HTMLAnchorElement | null;
                    const titleEl = node.querySelector('.conversation-title') as HTMLElement | null;

                    const href = link?.getAttribute('href') ?? '';
                    const idMatch = href.match(/\/app\/([a-zA-Z0-9]+)/);

                    const rawTitle = titleEl?.innerText ?? 'Sin título';
                    const cleanTitle = rawTitle.replace(/\s+/g, ' ').trim();

                    todasLasConversaciones.push({
                        id: idMatch ? idMatch[1] : '',
                        title: cleanTitle || 'Sin título',
                        url: href,
                        listGroup: parseInt(listNumber)
                    });
                });
            });

            return todasLasConversaciones;
        });
    } catch (error) {
        console.warn('No se detectó el historial o la estructura cambió.');
        return [];
    }
}