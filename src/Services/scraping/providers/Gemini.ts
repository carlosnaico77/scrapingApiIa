import type { Page } from "../../../config/config.js";
import type { conversationData } from "../../../interfaces/ia.interfaces.js";

export class GeminiProvider {
    static async extraerHistorial(page: Page): Promise<Record<number, conversationData[]>> {
        const containerSelector = 'div[id^="conversations-list-"]';
        try {
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