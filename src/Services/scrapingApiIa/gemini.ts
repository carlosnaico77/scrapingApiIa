import type { Page } from "../../config/config.js";
import type { conversationDataGemini } from "./interfaces.js";

export async function extraerConversacionesGemini(page: Page): Promise<conversationDataGemini[]> {
    const containerSelector = '#conversations-list-0';
    const itemSelector = '.conversation-items-container';

    try {

        await page.waitForSelector(containerSelector);
        const locator = page.locator(`${containerSelector} ${itemSelector}`);
        const count = await locator.count();


        if (count === 0) {
            return [];
        }


        return await page.locator(`${containerSelector} .conversation-items-container`).evaluateAll((nodes) => {

            return nodes.map((node) => {
                const link = node.querySelector('a[data-test-id="conversation"]') as HTMLAnchorElement | null;
                const titleEl = node.querySelector('.conversation-title') as HTMLElement | null;

                const href = link?.getAttribute('href') ?? '';
                const idMatch = href.match(/\/app\/([a-zA-Z0-9]+)/);
                const rawTitle: string = titleEl?.innerText ?? 'Sin título';
                const cleanTitle = rawTitle.split('\n')[0]?.trim() ?? 'Sin título';

                return {
                    id: idMatch ? (idMatch[1] || '') : '',
                    title: cleanTitle || 'Sin título',
                    url: href

                };
            });
        });

    } catch (error) {
        console.warn('No se detectó la lista de conversaciones o está vacía.');
        return [];
    }
}